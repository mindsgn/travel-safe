export type TemplateValues = Record<string, string | number>;

export function format(template: string, values: TemplateValues = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type PluralForms = { one: string; other: string };

export function plural(forms: PluralForms, count: number, values: TemplateValues = {}): string {
  return format(count === 1 ? forms.one : forms.other, { count, ...values });
}
