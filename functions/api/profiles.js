const STORE_KEY = "profiles";
const MAX_PROFILES = 100;
const MAX_FIELD_LENGTH = 120;
const MAX_TAG_LENGTH = 180;

const allowedStatuses = new Set(["Primary School", "Junior High", "Alumnus"]);
const allowedContactPreferences = new Set([
  "Group Chat Only",
  "Ask Admin First",
  "School Event Meetups",
  "Just expand my friend list"
]);

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

function getStore(context) {
  return context.env && context.env.PROFILES_KV;
}

async function readProfiles(store) {
  const profiles = await store.get(STORE_KEY, "json");
  return Array.isArray(profiles) ? profiles : [];
}

function cleanText(value, limit = MAX_FIELD_LENGTH) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanProfile(input) {
  const profile = {
    name: cleanText(input.name),
    status: cleanText(input.status),
    classYear: cleanText(input.classYear),
    contactPreference: cleanText(input.contactPreference),
    wechatId: cleanText(input.wechatId),
    tags: cleanText(input.tags, MAX_TAG_LENGTH)
  };

  const hasRequiredFields = Object.values(profile).every(Boolean);
  if (!hasRequiredFields) {
    return null;
  }

  if (!allowedStatuses.has(profile.status) || !allowedContactPreferences.has(profile.contactPreference)) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...profile
  };
}

export async function onRequestGet(context) {
  const store = getStore(context);
  if (!store) {
    return jsonResponse({ error: "Missing PROFILES_KV binding", profiles: [] }, 503);
  }

  const profiles = await readProfiles(store);
  return jsonResponse({ profiles });
}

export async function onRequestPost(context) {
  const store = getStore(context);
  if (!store) {
    return jsonResponse({ error: "Missing PROFILES_KV binding", profiles: [] }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const profile = cleanProfile(body);
  if (!profile) {
    return jsonResponse({ error: "Invalid profile" }, 400);
  }

  const profiles = await readProfiles(store);
  const nextProfiles = [profile, ...profiles].slice(0, MAX_PROFILES);
  await store.put(STORE_KEY, JSON.stringify(nextProfiles));

  return jsonResponse({ profile, profiles: nextProfiles }, 201);
}
