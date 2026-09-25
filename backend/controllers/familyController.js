const User = require('../models/User');
const { AppError, cleanString } = require('../utils/helpers');
const { notify } = require('../utils/services');

const MAX_MEMBERS = 6;

const membersOf = (group) => User.find({ 'family.group': group }).select('name email phone');

// GET /api/family — my family group (if any) and the invitations waiting for me.
const getFamily = async (req, res) => {
  const group = req.user.family?.group;
  const members = group ? await membersOf(group) : [];
  res.json({
    success: true,
    group: group ? { owner: group, isOwner: group.equals(req.user._id), members } : null,
    invites: req.user.family?.invites || [],
    me: req.user._id,
  });
};

// POST /api/family/invite { email } — owner (or a customer with no group yet) invites another customer.
const invite = async (req, res) => {
  const email = cleanString(req.body.email)?.toLowerCase();
  if (!email) throw new AppError('email is required', 400);
  const group = req.user.family?.group;
  if (group && !group.equals(req.user._id)) throw new AppError('Only the family owner can invite members', 403);

  const target = await User.findOne({ email, role: 'customer', isActive: true });
  if (!target) throw new AppError('No customer account found with that e-mail', 404);
  if (target._id.equals(req.user._id)) throw new AppError('You cannot invite yourself', 400);
  if (target.family?.group) throw new AppError('That person already belongs to a family group', 409);
  if (group && (await User.countDocuments({ 'family.group': group })) >= MAX_MEMBERS) {
    throw new AppError(`A family group can have at most ${MAX_MEMBERS} members`, 400);
  }

  const added = await User.updateOne(
    { _id: target._id, 'family.invites.from': { $ne: req.user._id } },
    { $push: { 'family.invites': { from: req.user._id, fromName: req.user.name } } }
  );
  if (!added.modifiedCount) throw new AppError('You already invited this person', 409);
  await notify(target._id, 'Family invitation', `${req.user.name} invited you to share a family account (orders and favorites).`, 'family', '/family');
  res.status(201).json({ success: true, message: 'Invitation sent' });
};

// POST /api/family/invites/:from/accept
const accept = async (req, res) => {
  if (req.user.family?.group) throw new AppError('Leave your current family group first', 409);
  const invitation = req.user.family?.invites?.find((item) => item.from.equals(req.params.from));
  if (!invitation) throw new AppError('Invitation not found', 404);
  const owner = await User.findOne({ _id: invitation.from, role: 'customer', isActive: true });
  if (!owner) throw new AppError('This family group no longer exists', 404);
  if (owner.family?.group && !owner.family.group.equals(owner._id)) throw new AppError('This family group no longer exists', 404);
  if ((await User.countDocuments({ 'family.group': owner._id })) >= MAX_MEMBERS) {
    throw new AppError(`A family group can have at most ${MAX_MEMBERS} members`, 400);
  }

  if (!owner.family?.group) await User.updateOne({ _id: owner._id }, { $set: { 'family.group': owner._id } });
  await User.updateOne({ _id: req.user._id }, { $set: { 'family.group': owner._id, 'family.invites': [] } });
  await notify(owner._id, 'Family member joined', `${req.user.name} joined your family account.`, 'family', '/family');
  res.json({ success: true, message: 'You joined the family group' });
};

// POST /api/family/invites/:from/decline
const decline = async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { 'family.invites': { from: req.params.from } } });
  res.json({ success: true });
};

// DELETE /api/family/members/:id — the owner removes a member.
const removeMember = async (req, res) => {
  const group = req.user.family?.group;
  if (!group || !group.equals(req.user._id)) throw new AppError('Only the family owner can remove members', 403);
  if (req.params.id === String(req.user._id)) throw new AppError('Use "Leave group" to disband the family', 400);
  const removed = await User.updateOne({ _id: req.params.id, 'family.group': group }, { $unset: { 'family.group': 1 } });
  if (!removed.modifiedCount) throw new AppError('Member not found', 404);
  await notify(req.params.id, 'Removed from family', `${req.user.name} removed you from their family account.`, 'family', '/family');
  res.json({ success: true });
};

// POST /api/family/leave — a member leaves; if the owner leaves, the whole group is disbanded.
const leave = async (req, res) => {
  const group = req.user.family?.group;
  if (!group) throw new AppError('You are not in a family group', 400);
  if (group.equals(req.user._id)) await User.updateMany({ 'family.group': group }, { $unset: { 'family.group': 1 } });
  else await User.updateOne({ _id: req.user._id }, { $unset: { 'family.group': 1 } });
  res.json({ success: true });
};

// GET /api/family/favorites — products, farmers and markets hearted by anyone in the group.
const familyFavorites = async (req, res) => {
  const group = req.user.family?.group;
  if (!group) return res.json({ success: true, favorites: { products: [], farmers: [], markets: [] } });
  const members = await User.find({ 'family.group': group })
    .select('name favorites')
    .populate('favorites.farmers', 'farmerProfile.stallName farmerProfile.location')
    .populate('favorites.products', 'name price unit quantityAvailable available image farmer')
    .populate('favorites.markets', 'name address operatingDays openTime closeTime');
  const merged = { products: new Map(), farmers: new Map(), markets: new Map() };
  for (const member of members) {
    for (const type of Object.keys(merged)) {
      for (const item of member.favorites[type] || []) {
        if (!item) continue;
        const entry = merged[type].get(String(item._id)) || { item, savedBy: [] };
        entry.savedBy.push(member.name);
        merged[type].set(String(item._id), entry);
      }
    }
  }
  const out = {};
  for (const type of Object.keys(merged)) out[type] = [...merged[type].values()].map(({ item, savedBy }) => ({ ...item.toJSON(), savedBy }));
  res.json({ success: true, favorites: out });
};

module.exports = { getFamily, invite, accept, decline, removeMember, leave, familyFavorites };
