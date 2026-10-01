const snake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

export const mapObjectKeys = (o: any, fn: (k: string) => string): any => {
  if (Array.isArray(o)) {
    return o.map((x) => mapObjectKeys(x, fn));
  }
  if (o && typeof o === 'object' && !(o instanceof Date)) {
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => {
        let newKey = fn(k);
        if (k === '_id') {
          newKey = fn === camel ? 'id' : '_id';
        }
        return [newKey, mapObjectKeys(v, fn)];
      })
    );
  }
  return o;
};

export const fromApi = (o: any) => mapObjectKeys(o, camel);
export const toApi = (o: any) => mapObjectKeys(o, snake);
