// =========================================================
// إعدادات الأقسام: كل قسم إله مجال أرقام غرف خاص فيه
// عدّلي الاسم أو مجال الغرف هون بس، وبتنعكس تلقائياً
// على كل صفحات النظام (المريض، الممرضة، الإدارة)
// =========================================================
export const DEPARTMENTS = [
  { id: "emergency",  name: "الطوارئ",              roomStart: 101, roomEnd: 199 },
  { id: "internal",   name: "الباطنية",              roomStart: 201, roomEnd: 299 },
  { id: "surgery",    name: "الجراحة",               roomStart: 301, roomEnd: 399 },
  { id: "pediatrics", name: "الأطفال",               roomStart: 401, roomEnd: 499 },
  { id: "obgyn",      name: "النسائية والولادة",      roomStart: 501, roomEnd: 599 },
  { id: "icu",        name: "العناية المركزة",        roomStart: 601, roomEnd: 699 },
];

// إيجاد القسم المسؤول عن غرفة معينة حسب رقمها
export function departmentForRoom(room) {
  const n = parseInt(room, 10);
  if (isNaN(n)) return null;
  return DEPARTMENTS.find((d) => n >= d.roomStart && n <= d.roomEnd) || null;
}

export function departmentName(id) {
  const dept = DEPARTMENTS.find((d) => d.id === id);
  return dept ? dept.name : "قسم غير محدد";
}
