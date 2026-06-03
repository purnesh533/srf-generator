export function toApi(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  delete o.__v;
  return o;
}
