import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const CACHE_KEY = "departments_cache_v1";

const DEFAULT_DEPARTMENTS = [
  { id: "emergency",  name: "الطوارئ",         roomStart: 101, roomEnd: 199, order: 0 },
  { id: "internal",   name: "الباطنية",         roomStart: 201, roomEnd: 299, order: 1 },
  { id: "surgery",    name: "الجراحة",          roomStart: 301, roomEnd: 399, order: 2 },
  { id: "pediatrics", name: "الأطفال",          roomStart: 401, roomEnd: 499, order: 3 },
  { id: "obgyn",      name: "النسائية والولادة", roomStart: 501, roomEnd: 599, order: 4 },
  { id: "icu",        name: "العناية المركزة",   roomStart: 601, roomEnd: 699, order: 5 },
];

export let DEPARTMENTS = loadCachedDepartments();

function loadCachedDepartments() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [...DEFAULT_DEPARTMENTS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_DEPARTMENTS];
    return parsed;
  } catch {
    return [...DEFAULT_DEPARTMENTS];
  }
}

function saveCachedDepartments(list) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    // ignore cache write errors
  }
}

export async function refreshDepartments() {
  try {
    const q = query(collection(db, "departmentsConfig"), orderBy("order", "asc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      DEPARTMENTS = [...DEFAULT_DEPARTMENTS];
      saveCachedDepartments(DEPARTMENTS);
      return DEPARTMENTS;
    }

    const list = snap.docs.map((d, idx) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        name: String(data.name || "قسم"),
        roomStart: Number(data.roomStart),
        roomEnd: Number(data.roomEnd),
        order: Number.isFinite(Number(data.order)) ? Number(data.order) : idx,
      };
    }).filter((d) => Number.isFinite(d.roomStart) && Number.isFinite(d.roomEnd));

    if (list.length > 0) {
      DEPARTMENTS = list;
      saveCachedDepartments(DEPARTMENTS);
    }

    return DEPARTMENTS;
  } catch (err) {
    console.warn("تعذر تحميل الأقسام من Firestore، تم استخدام النسخة المحلية", err);
    return DEPARTMENTS;
  }
}

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

export function createDepartmentId(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-") || `dept-${Date.now()}`;
}

