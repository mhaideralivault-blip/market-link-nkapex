const User = require('../models/User');
const { AppError, requireFields, isEmail, isValidName, isValidPhone, passwordIssues, signToken, cleanString } = require('../utils/helpers');

// Checks shared by customer and farmer sign-up: valid e-mail, contact number, and a strong password.
const validateCommon = (body) => {
  if (!isEmail(body.email)) throw new AppError('Invalid e-mail address', 400);
  if (!isValidPhone(body.phone)) throw new AppError('Enter a valid contact number (at least 7 digits)', 400);
  const issues = passwordIssues(body.password);
  if (issues.length) throw new AppError(`Password must have ${issues.join(', ')}`, 400);
};

const sendAuth = (res, user, status = 200) =>
  res.status(status).json({ success: true, token: signToken(user), user });

// Customer registration: name, contact number, e-mail and address are mandatory.
const registerCustomer = async (req, res) => {
  const body = req.body;
  requireFields(body, ['name', 'email', 'phone', 'address', 'password']);
  if (!isValidName(body.name)) throw new AppError('Enter a name of at least 2 letters', 400);
  validateCommon(body);

  const user = await User.create({
    name: cleanString(body.name),
    email: body.email,
    phone: cleanString(body.phone),
    address: cleanString(body.address),
    password: body.password,
    role: 'customer',
  });
  sendAuth(res, user, 201);
};

// Farmer registration: stall name, contact person, number, e-mail, address. Starts as "pending".
const registerFarmer = async (req, res) => {
  const body = req.body;
  requireFields(body, ['stallName', 'contactPerson', 'email', 'phone', 'address', 'password']);
  if (!isValidName(body.contactPerson)) throw new AppError('Enter a contact person name of at least 2 letters', 400);
  if (!cleanString(body.stallName) || body.stallName.trim().length < 2) throw new AppError('Enter a stall/business name of at least 2 characters', 400);
  validateCommon(body);

  const user = await User.create({
    name: cleanString(body.contactPerson),
    email: body.email,
    phone: cleanString(body.phone),
    address: cleanString(body.address),
    password: body.password,
    role: 'farmer',
    farmerProfile: {
      stallName: cleanString(body.stallName),
      contactPerson: cleanString(body.contactPerson),
      approvalStatus: 'pending',
    },
  });
  sendAuth(res, user, 201);
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new AppError('E-mail and password are required', 400);
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new AppError('Invalid credentials', 401);
  if (!user.isActive) throw new AppError('Account is deactivated. Contact support.', 403);
  user.password = undefined;
  sendAuth(res, user);
};

const getMe = (req, res) => res.json({ success: true, user: req.user });

const updateMe = async (req, res) => {
  const { name, phone, address } = req.body;
  if (cleanString(name)) req.user.name = cleanString(name);
  if (cleanString(phone)) req.user.phone = cleanString(phone);
  if (cleanString(address)) req.user.address = cleanString(address);
  await req.user.save();
  res.json({ success: true, user: req.user });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || !currentPassword) throw new AppError('Current password is required', 400);
  const issues = passwordIssues(newPassword);
  if (issues.length) throw new AppError(`New password must have ${issues.join(', ')}`, 400);
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword))) throw new AppError('Current password is incorrect', 401);
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
};

module.exports = { registerCustomer, registerFarmer, login, getMe, updateMe, changePassword };
