import { ApiError, NetworkError } from './api/client';
import type { CheckInPayload, CheckInResponse } from './api/deadman-api';
import { enqueue, flushQueue, MAX_PENDING } from './check-in-queue';

const payload = (id: string): CheckInPayload => ({
  clientId: id,
  occurredAt: '2026-01-10T09:00:00.000Z',
  location: null,
  device: null,
});

const response = (id: string): CheckInResponse =>
  ({ check_in: { client_id: id }, created: true, resolved_event_ids: [], status: {} }) as unknown as CheckInResponse;

describe('check-in queue', () => {
  it('enqueues and caps the queue at the newest entries', () => {
    let queue = enqueue([], payload('a'));
    expect(queue).toEqual([{ ...payload('a'), attempts: 0 }]);
    for (let index = 0; index < MAX_PENDING + 5; index += 1) queue = enqueue(queue, payload(`p${index}`));
    expect(queue).toHaveLength(MAX_PENDING);
    expect(queue[queue.length - 1].clientId).toBe(`p${MAX_PENDING + 4}`);
  });

  it('flushes every item when the network is available', async () => {
    const send = jest.fn(async (item: CheckInPayload) => response(item.clientId));
    const result = await flushQueue(enqueue(enqueue([], payload('a')), payload('b')), send);
    expect(result).toMatchObject({ remaining: [], confirmedIds: ['a', 'b'], droppedIds: [], stoppedBy: 'none' });
    expect(result.lastResponse?.check_in.client_id).toBe('b');
    expect(send.mock.calls[0][0]).not.toHaveProperty('attempts');
  });

  it('keeps items when the network is unavailable', async () => {
    const queue = enqueue(enqueue([], payload('a')), payload('b'));
    const result = await flushQueue(queue, jest.fn().mockRejectedValue(new NetworkError()));
    expect(result.stoppedBy).toBe('offline');
    expect(result.remaining.map((item) => item.clientId)).toEqual(['a', 'b']);
    expect(result.remaining[0].attempts).toBe(1);
  });

  it('keeps items during server outages', async () => {
    const result = await flushQueue(enqueue([], payload('a')), jest.fn().mockRejectedValue(new ApiError('x', 503)));
    expect(result.stoppedBy).toBe('offline');
    expect(result.remaining).toHaveLength(1);
  });

  it('stops on authentication failure without dropping data', async () => {
    const result = await flushQueue(enqueue([], payload('a')), jest.fn().mockRejectedValue(new ApiError('x', 401)));
    expect(result.stoppedBy).toBe('auth');
    expect(result.remaining).toHaveLength(1);
  });

  it('drops items the server permanently rejects', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('bad', 422))
      .mockResolvedValueOnce(response('b'));
    const result = await flushQueue(enqueue(enqueue([], payload('a')), payload('b')), send);
    expect(result).toMatchObject({ remaining: [], confirmedIds: ['b'], droppedIds: ['a'], stoppedBy: 'none' });
  });

  it('synchronizes successfully after connectivity returns', async () => {
    const queue = enqueue([], payload('a'));
    const offline = await flushQueue(queue, jest.fn().mockRejectedValue(new NetworkError()));
    const online = await flushQueue(offline.remaining, async (item) => response(item.clientId));
    expect(online.remaining).toEqual([]);
    expect(online.lastResponse?.check_in.client_id).toBe('a');
  });
});
