import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, User, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Input, Alert } from '../components/UI.jsx';
import toast from 'react-hot-toast';

export const Register = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const password = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      await registerUser(
        data.fullName,
        data.email,
        data.password
      );

      toast.success(
        'Registration successful! Please verify your email.'
      );

      navigate('/login');
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Registration failed. Please try again.';

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-base-200 relative overflow-hidden">

      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-secondary/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-primary text-primary-content flex items-center justify-center mx-auto shadow-xl">
            <User size={36} />
          </div>

          <h1 className="mt-4 text-4xl font-bold">
            Create Account
          </h1>

          <p className="text-base-content/60 mt-2">
            Join Inventory Management System
          </p>
        </div>

        {/* Card */}
        <div className="backdrop-blur-xl bg-base-100/80 border border-base-300 shadow-2xl rounded-3xl p-8">

          {error && (
            <div className="mb-4">
              <Alert variant="error" title="Registration Failed">
                {error}
              </Alert>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
          >
            {/* Full Name */}
            <div>
              <label className="label">
                <span className="label-text font-medium">
                  Full Name
                </span>
              </label>

              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
                />

                <Input
                  type="text"
                  placeholder="John Doe"
                  className="pl-10"
                  error={!!errors.fullName}
                  helperText={errors.fullName?.message}
                  {...register('fullName', {
                    required: 'Full name is required',
                    minLength: {
                      value: 2,
                      message:
                        'Name must be at least 2 characters',
                    },
                  })}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">
                <span className="label-text font-medium">
                  Email Address
                </span>
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
                />

                <Input
                  type="email"
                  placeholder="john@example.com"
                  className="pl-10"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value:
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Invalid email address',
                    },
                  })}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">
                <span className="label-text font-medium">
                  Password
                </span>
              </label>

              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
                />

                <Input
                  type={
                    showPassword ? 'text' : 'password'
                  }
                  placeholder="Enter password"
                  className="pl-10 pr-12"
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message:
                        'Password must be at least 6 characters',
                    },
                  })}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">
                <span className="label-text font-medium">
                  Confirm Password
                </span>
              </label>

              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
                />

                <Input
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Confirm password"
                  className="pl-10 pr-12"
                  error={!!errors.confirmPassword}
                  helperText={
                    errors.confirmPassword?.message
                  }
                  {...register('confirmPassword', {
                    required:
                      'Please confirm your password',
                    validate: (value) =>
                      value === password ||
                      'Passwords do not match',
                  })}
                />
                 <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              className="h-12 text-base font-semibold rounded-xl"
            >
              Create Account
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-base-content/60">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary font-semibold hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;



