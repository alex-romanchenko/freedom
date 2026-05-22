const bcrypt = require('bcrypt');
const {
  createUser,
  findUserByEmail,
  findUserByUsername,
} = require('../models/user.model');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const {
  createEmailToken,
  findEmailToken,
  deleteEmailToken,
} = require('../models/emailToken.model');
const pool = require('../db');
const { createPasswordToken, findPasswordToken, deletePasswordToken } = require('../models/passwordToken.model');


async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    const user = await findUserByEmail(email);


    if (!user) {
      return res.status(400).json({
        message: 'User not found',
      });
    }
    if (!user.is_verified) {
      return res.status(403).json({
        message: 'Please confirm your email first',
      });
    }
    const token = crypto.randomBytes(32).toString('hex');

    await createPasswordToken(user.id, token);

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    await sendEmail(
      user.email,
      'Reset your password',
      `<h2>Password reset</h2>
       <p>Click the link below:</p>
       <a href="${resetLink}">${resetLink}</a>`
    );

    res.json({ message: 'Reset link sent to email' });
  } catch (error) {
    res.status(500).json({
      message: 'Error sending reset email',
      error: error.message,
    });
  }
}

async function resetPassword(req, res) {
  try {
    const { token } = req.query;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: 'Password is required',
      });
    }

    const tokenData = await findPasswordToken(token);

    if (!tokenData) {
      return res.status(400).json({
        message: 'Invalid or expired token',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [hashedPassword, tokenData.user_id]
    );

    await deletePasswordToken(token);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({
      message: 'Error resetting password',
      error: error.message,
    });
  }
}

async function register(req, res) {
  try {
    const { username, email, password, displayName } = req.body;

    const usernameRegex = /^[A-Za-z]{2,10}$/;
    const displayNameRegex = /^[A-Za-zА-Яа-яІіЇїЄєҐґ\s]{2,10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message:
          'Username must contain only letters and be 2-10 characters long',
      });
    }

    if (displayName && !displayNameRegex.test(displayName)) {
      return res.status(400).json({
        message:
          'Display name must contain only letters and be 2-10 characters long',
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Enter a valid email address',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          'Password must be at least 6 characters long',
      });
    }

    const existingEmail = await findUserByEmail(email);

    if (existingEmail) {
      return res.status(400).json({
        message: 'Email already exists',
      });
    }

    const existingUsername = await findUserByUsername(username);

    if (existingUsername) {
      return res.status(400).json({
        message: 'Username already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await createUser({
      username,
      email,
      password: hashedPassword,
      displayName: displayName || username,
    });

    const token = crypto.randomBytes(32).toString('hex');

    await createEmailToken(user.id, token);

    const verifyLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    await sendEmail(
      user.email,
      'Verify your email',
      `<h2>Verify your email</h2>
      <p>Click the link below:</p>
      <a href="${verifyLink}">${verifyLink}</a>`
    );

    res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Registration error',
      error: error.message,
    });
  }

}

async function verifyEmail(req, res) {
  try {
    const { token } = req.query;

    const tokenData = await findEmailToken(token);

    if (!tokenData) {
      return res.status(400).send('Invalid or expired token');
    }

    await pool.query(
      `UPDATE users SET is_verified = true WHERE id = $1`,
      [tokenData.user_id]
    );

    await deleteEmailToken(token);

    res.send('Email verified successfully ✅');
  } catch (error) {
    res.status(500).send('Error verifying email');
  }
}

const jwt = require('jsonwebtoken');

async function login(req, res) {
  try {
    const { login, password, rememberMe } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        message: 'Login and password are required',
      });
    }

    const user =
      (await findUserByEmail(login)) ||
      (await findUserByUsername(login));

    if (!user) {
      return res.status(400).json({
        message: 'Invalid login or password',
      });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        message: 'Please check your mailbox and confirm your email before login',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        message: 'Invalid login or password',
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: rememberMe ? '30d' : '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        avatar: user.avatar,
        headerImage: user.header_image,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Login error',
      error: error.message,
    });
  }
}

async function resendVerificationEmail(req, res) {
  try {
    const { email } = req.body;

    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(400).json({
        message: 'User not found',
      });
    }

    if (user.is_verified) {
      return res.status(400).json({
        message: 'Email is already verified',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    await createEmailToken(user.id, token);

    const verifyLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    await sendEmail(
      user.email,
      'Verify your email',
      `<h2>Verify your email</h2>
       <p>Click the link below:</p>
       <a href="${verifyLink}">${verifyLink}</a>`
    );

    res.json({
      message: 'Verification email sent. Please check your mailbox.',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error resending verification email',
      error: error.message,
    });
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerificationEmail
};