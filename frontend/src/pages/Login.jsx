import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Package, ShieldCheck, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Input, Alert, Card } from '../components/UI.jsx';
import toast from 'react-hot-toast';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      await login(data.email, data.password);

      toast.success('Login successful');
      navigate('/dashboard');
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Login failed. Please check your credentials.';

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 flex">
      {/* Left Section */}
      <div className="hidden lg:flex w-1/2 bg-primary items-center justify-center relative overflow-hidden">
        <div className="absolute w-72 h-72 rounded-full bg-primary-hover/20 -top-20 -left-20" />
        <div className="absolute w-96 h-96 rounded-full bg-secondary/20 -bottom-32 -right-32" />

        <div className="relative z-10 max-w-lg text-center px-10 text-primary-content">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-3xl bg-base-100/10 backdrop-blur-md flex items-center justify-center">
              <Package size={48} />
            </div>
          </div>

          <h1 className="text-5xl font-bold mb-6">
            Inventory Management
          </h1>

          <p className="text-lg opacity-90 mb-10">
            Manage products, invoices, stock and analytics
            from one powerful dashboard.
          </p>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-base-100/10 rounded-2xl p-4 backdrop-blur-sm">
              <ShieldCheck className="mx-auto mb-2" />
              <p className="text-sm">Secure</p>
            </div>

            <div className="bg-base-100/10 rounded-2xl p-4 backdrop-blur-sm">
              <Package className="mx-auto mb-2" />
              <p className="text-sm">Inventory</p>
            </div>

            <div className="bg-base-100/10 rounded-2xl p-4 backdrop-blur-sm">
              <BarChart3 className="mx-auto mb-2" />
              <p className="text-sm">Reports</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-base-200">
        <Card className="w-full max-w-md shadow-2xl border border-base-300 bg-base-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-content mb-4">
              <Package size={30} />
            </div>

            <h2 className="text-3xl font-bold text-base-content">
              Welcome Back
            </h2>

            <p className="text-base-content/60 mt-2">
              Login to access your dashboard
            </p>
          </div>

          {error && (
            <div className="mb-4">
              <Alert variant="error" title="Login Failed">
                {error}
              </Alert>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <div>
              <label className="block text-sm font-medium mb-2">
                Email Address
              </label>

              <Input
                type="email"
                placeholder="john@example.com"
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

            <div>
              <label className="block text-sm font-medium mb-2">
                Password
              </label>

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  {...register('password', {
                    required: 'Password is required',
                  })}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  className="absolute right-4 top-3 text-base-content/50 hover:text-primary"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                />
                <span className="ml-2">
                  Remember me
                </span>
              </label>

              <Link
                to="/forgot-password"
                className="text-primary hover:underline"
              >
                Forgot Password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              className="h-12 text-base font-semibold"
            >
              Sign In
            </Button>
          </form>

          <div className="divider my-6">
            OR
          </div>

          <Button
            variant="secondary"
            fullWidth
            className="h-12"
          >
            Continue as Guest
          </Button>

          <p className="text-center text-base-content/60 mt-6">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-primary font-semibold hover:underline"
            >
              Create Account
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Login;