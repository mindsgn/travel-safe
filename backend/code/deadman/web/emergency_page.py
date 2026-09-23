from __future__ import annotations

import json
import sqlite3
from html import escape

from deadman.timeutil import format_human, from_db

MAX_JOURNEY_POINTS = 500


def build_view(connection: sqlite3.Connection, event_id: str, link_expires_at: str) -> dict:
    """Minimal data for recipients: no contact list, no internal ids."""
    event = connection.execute(
        """
        SELECT e.*, u.name AS user_name, u.timezone
        FROM deadman_events e JOIN users u ON u.id = e.user_id
        WHERE e.id = ?
        """,
        (event_id,),
    ).fetchone()
    journey_rows = connection.execute(
        """
        SELECT latitude, longitude, recorded_at FROM locations
        WHERE deadman_event_id = ? ORDER BY recorded_at LIMIT ?
        """,
        (event_id, MAX_JOURNEY_POINTS),
    ).fetchall()
    location = None
    if event["latitude"] is not None and event["longitude"] is not None:
        location = {
            "latitude": event["latitude"],
            "longitude": event["longitude"],
            "accuracy_m": event["accuracy_m"],
            "recorded_at": event["location_recorded_at"],
            "address": event["address"],
        }
    return {
        "user_name": event["user_name"],
        "timezone": event["timezone"],
        "status": event["status"],
        "last_check_in_at": event["last_check_in_at"],
        "deadline_at": event["deadline_at"],
        "triggered_at": event["triggered_at"],
        "resolved_at": event["resolved_at"],
        "battery_level": event["battery_level"],
        "location": location,
        "journey": [dict(row) for row in journey_rows],
        "link_expires_at": link_expires_at,
    }


def _human(value: str | None, zone: str | None) -> str:
    return format_human(from_db(value), zone)


def _row(label: str, value: str) -> str:
    return f'<div class="row"><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>'


PAGE_STYLE = """
:root{color-scheme:light dark;--bg:#f7f8f7;--card:#fff;--text:#1c2024;--muted:#60646c;--accent:#1f6f5c;--ok:#1f6f5c;--warn:#a35200}
@media (prefers-color-scheme:dark){:root{--bg:#111312;--card:#1b1d1c;--text:#edeeed;--muted:#a9adab;--accent:#5fc3a6;--ok:#5fc3a6;--warn:#f0a35e}}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}h1{font-size:24px;margin:0 0 8px}p{margin:0 0 12px}
.card{background:var(--card);border-radius:16px;padding:20px;margin-top:16px}.muted{color:var(--muted);font-size:14px}
.badge{display:inline-block;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600;margin-bottom:12px}
.badge.triggered{background:rgba(163,82,0,.12);color:var(--warn)}.badge.resolved{background:rgba(31,111,92,.12);color:var(--ok)}
dl{margin:0}.row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid rgba(127,127,127,.15)}
.row:first-child{border-top:0}dt{color:var(--muted)}dd{margin:0;text-align:right;font-weight:500}
#map{height:360px;border-radius:12px;margin-top:12px;background:rgba(127,127,127,.1)}
a{color:var(--accent)}ul{padding-left:20px;margin:0}
"""


def render_page(view: dict, mapbox_token: str | None, nonce: str) -> str:
    zone = view["timezone"]
    name = view["user_name"]
    resolved = view["status"] == "resolved"
    location = view["location"]

    if resolved:
        badge = '<span class="badge resolved">Checked in since</span>'
        headline = f"{escape(name)} has checked in again"
        intro = (
            f"{escape(name)} checked in on {escape(_human(view['resolved_at'], zone))}, after their "
            "deadline had passed. No further action is needed from this alert."
        )
    else:
        badge = '<span class="badge triggered">Missed check-in</span>'
        headline = f"{escape(name)} missed a scheduled safety check-in"
        intro = (
            f"{escape(name)} uses Deadman Switch to check in on a regular schedule and listed you as an "
            "emergency contact. They didn't check in before their deadline. This doesn't necessarily mean "
            "something is wrong."
        )

    facts = [
        _row("Last check-in", _human(view["last_check_in_at"], zone)),
        _row("Check-in was due by", _human(view["deadline_at"], zone)),
    ]
    if location:
        place = location["address"] or f"{location['latitude']:.5f}, {location['longitude']:.5f}"
        facts.append(_row("Last known location", place))
        facts.append(_row("Location recorded", _human(location["recorded_at"], zone)))
        if location["accuracy_m"] is not None:
            facts.append(_row("Location accuracy", f"within about {round(location['accuracy_m'])} m"))
    else:
        facts.append(_row("Last known location", "Not shared"))
    if view["battery_level"] is not None:
        facts.append(_row("Phone battery at last contact", f"{round(view['battery_level'] * 100)}%"))

    map_section = ""
    map_script = ""
    if location and mapbox_token:
        map_data = json.dumps(
            {
                "token": mapbox_token,
                "location": [location["longitude"], location["latitude"]],
                "journey": [[point["longitude"], point["latitude"]] for point in view["journey"]],
            }
        ).replace("<", "\\u003c")
        map_section = (
            '<section class="card"><h2 style="font-size:18px;margin:0">Map</h2>'
            '<p class="muted">The pin is the last known location. The line shows recent movement, if any was shared.</p>'
            '<div id="map" role="img" aria-label="Map of last known location"></div></section>'
        )
        map_script = f"""
<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js"></script>
<script type="application/json" id="map-data">{map_data}</script>
<script nonce="{nonce}">
(function(){{
  var data = JSON.parse(document.getElementById('map-data').textContent);
  if (!window.mapboxgl) return;
  mapboxgl.accessToken = data.token;
  var map = new mapboxgl.Map({{container:'map', style:'mapbox://styles/mapbox/streets-v12', center:data.location, zoom:14}});
  new mapboxgl.Marker({{color:'#1f6f5c'}}).setLngLat(data.location).addTo(map);
  if (data.journey.length > 1) {{
    map.on('load', function(){{
      map.addSource('journey', {{type:'geojson', data:{{type:'Feature', geometry:{{type:'LineString', coordinates:data.journey}}}}}});
      map.addLayer({{id:'journey', type:'line', source:'journey', paint:{{'line-color':'#1f6f5c','line-width':4,'line-opacity':0.7}}}});
    }});
  }}
}})();
</script>"""
    elif location:
        maps_url = f"https://www.openstreetmap.org/?mlat={location['latitude']}&mlon={location['longitude']}#map=16/{location['latitude']}/{location['longitude']}"
        map_section = (
            f'<section class="card"><a href="{escape(maps_url, quote=True)}" rel="noreferrer noopener" '
            'target="_blank">Open location in a map</a></section>'
        )

    unknowns = "" if resolved else f"""
<section class="card"><h2 style="font-size:18px;margin:0 0 8px">What we don't know</h2>
<ul><li>Where {escape(name)} is right now, or whether they need help.</li>
<li>Location and battery details are from the last time their phone contacted us and may be out of date.</li></ul></section>
<section class="card"><h2 style="font-size:18px;margin:0 0 8px">What you can do</h2>
<ul><li>Try to contact {escape(name)} directly.</li>
<li>Check with people who might be with them.</li>
<li>If you believe they are in danger, contact your local emergency services.</li></ul></section>"""

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Deadman Switch: {escape(name)}</title>
<style>{PAGE_STYLE}</style></head>
<body><main>
{badge}<h1>{headline}</h1><p>{intro}</p>
<section class="card"><h2 style="font-size:18px;margin:0 0 8px">What we know</h2><dl>{"".join(facts)}</dl></section>
{map_section}{unknowns}
<p class="muted" style="margin-top:24px">This private link expires {escape(_human(view["link_expires_at"], zone))}. Please don't share it.</p>
</main>{map_script}</body></html>"""


def render_unavailable() -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Link unavailable</title><style>{PAGE_STYLE}</style></head>
<body><main><h1>This link is no longer available</h1>
<p>Emergency links expire after a set time to protect the person's privacy. If you're worried about someone, try to contact them directly or contact your local emergency services.</p>
</main></body></html>"""


def content_security_policy(nonce: str) -> str:
    return "; ".join(
        [
            "default-src 'none'",
            f"script-src 'nonce-{nonce}' https://api.mapbox.com",
            "style-src 'unsafe-inline' https://api.mapbox.com",
            "img-src data: blob: https://*.mapbox.com",
            "connect-src https://*.mapbox.com https://events.mapbox.com",
            "worker-src blob:",
            "child-src blob:",
            "font-src https://api.mapbox.com",
            "base-uri 'none'",
            "form-action 'none'",
            "frame-ancestors 'none'",
        ]
    )
