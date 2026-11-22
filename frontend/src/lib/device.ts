export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function deviceId(): string {
  try {
    let id = localStorage.getItem('ps_device_id');
    if (!id) { id = `dev-${uuid().slice(0, 8)}`; localStorage.setItem('ps_device_id', id); }
    return id;
  } catch { return 'dev-anon'; }
}
