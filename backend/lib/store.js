// ============================================================
// PickyPal — Mongo-backed store
// Same function signatures as the original store.ts (which used
// in-memory Maps) — but now backed by real MongoDB collections,
// so data survives restarts and works across multiple instances.
// ============================================================
import User from "../models/User.js";
import Order from "../models/Order.js";
import ConversationLog from "../models/ConversationLog.js";

// --- Users ---

export async function getOrCreateUser(sessionId) {
  let user = await User.findOne({ session_phone: sessionId });
  if (!user) {
    user = await User.create({ session_phone: sessionId });
  }
  return user;
}

export async function updateUserPreferences(sessionId, updates) {
  const user = await User.findOne({ session_phone: sessionId });
  if (!user) throw new Error(`User not found: ${sessionId}`);

  if (updates.allergies?.length) {
    user.allergies = [...new Set([...user.allergies, ...updates.allergies])];
  }
  if (updates.dietary_restrictions?.length) {
    user.dietary_restrictions = [
      ...new Set([...user.dietary_restrictions, ...updates.dietary_restrictions]),
    ];
  }
  if (updates.name !== undefined && updates.name !== null) user.name = updates.name;
  if (updates.language_pref) user.language_pref = updates.language_pref;

  await user.save();
  return user;
}

// Sets onboarding contact fields (name/phone/address) directly, used by the
// deterministic onboarding steps in the orchestrator.
export async function updateUserContact(sessionId, updates) {
  const user = await User.findOne({ session_phone: sessionId });
  if (!user) throw new Error(`User not found: ${sessionId}`);

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.phone !== undefined) user.phone = updates.phone;
  if (updates.address !== undefined) user.address = updates.address;
  if (updates.onboarding_complete !== undefined) user.onboarding_complete = updates.onboarding_complete;

  await user.save();
  return user;
}

// --- Orders ---

export async function createOrder(userId, restaurantId, restaurantName, items, total, extra = {}) {
  return Order.create({
    user_id: userId,
    restaurant_id: restaurantId,
    restaurant_name: restaurantName,
    items,
    total,
    ...extra,
  });
}

export async function updateOrderItems(orderId, items, total, restaurantId, restaurantName, deliveryFee = 100) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  order.items = items;
  order.delivery_fee = deliveryFee;
  order.total = total + deliveryFee;
  if (restaurantId) order.restaurant_id = restaurantId;
  if (restaurantName) order.restaurant_name = restaurantName;
  await order.save();
  return order;
}

export async function confirmOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  order.confirmed = true;
  await order.save();
  return order;
}

export async function setOrderPaymentMethod(orderId, method) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  order.payment_method = method;
  await order.save();
  return order;
}

export async function getActiveOrder(userId) {
  return Order.findOne({ user_id: userId, status: { $ne: "delivered" } }).sort({
    created_at: -1,
  });
}

// Order that has items but hasn't been confirmed/checked-out yet — this is
// what "ordering" phase reads/writes so we don't create a new DB row per turn.
export async function getDraftOrder(userId) {
  return Order.findOne({ user_id: userId, confirmed: false, status: "placed" }).sort({
    created_at: -1,
  });
}

export async function updateOrderStatus(orderId, status) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  order.status = status;
  await order.save();
  return order;
}

export async function setOrderReference(orderId, reference) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  order.payment_reference = reference;
  await order.save();
  return order;
}

export async function updateOrderPayment(orderId, reference) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  order.payment_status = "paid";
  if (reference) order.payment_reference = reference;
  await order.save();
  return order;
}

// --- Conversation State (per session) ---

export async function getConversation(sessionId) {
  let conv = await ConversationLog.findOne({ session_id: sessionId });
  if (!conv) {
    conv = await ConversationLog.create({ session_id: sessionId });
  }
  return conv;
}

export async function updateConversation(sessionId, updates) {
  const conv = await getConversation(sessionId);
  Object.assign(conv, updates);
  await conv.save();
  return conv;
}

export async function addMessage(sessionId, message) {
  const conv = await getConversation(sessionId);
  conv.messages.push(message);
  await conv.save();
}

export async function addTraceStep(sessionId, step) {
  const conv = await getConversation(sessionId);
  conv.trace_steps.push(step);
  await conv.save();
}
