import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, EyeOff, Package, ShieldCheck, BarChart3, 
  Mail, Lock, ArrowRight, Github, Chrome 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Input, Alert } from '../components/UI.jsx';
import toast from 'react-hot-toast';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    trigger,
  } = useForm({ mode: 'onChange' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const watchEmail = watch('email');
  const watchPassword = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      // Simulate API delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      await login(data.email, data.password);
      
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', data.email);
      }

      toast.success('Welcome back! 🎉');
      navigate('/dashboard');
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Invalid email or password. Please try again.';

      setError(message);
      toast.error(message);
      
      // Shake animation on error
      const form = document.getElementById('login-form');
      form.classList.add('animate-shake');
      setTimeout(() => form.classList.remove('animate-shake'), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    toast.success(`Logging in with ${provider}...`);
    // Implement social login logic
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-100 via-base-200 to-base-300 flex">
      {/* Left Section - Enhanced with animations */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary to-primary-focus items-center justify-center relative overflow-hidden"
      >
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <motion.div 
            animate={{ 
              rotate: 360,
              scale: [1, 1.2, 1],
            }}
            transition={{ 
              duration: 20,
              repeat: Infinity,
              ease: "linear" 
            }}
            className="absolute w-[600px] h-[600px] rounded-full bg-white/5 -top-20 -left-20"
          />
          <motion.div 
            animate={{ 
              rotate: -360,
              scale: [1.2, 1, 1.2],
            }}
            transition={{ 
              duration: 25,
              repeat: Infinity,
              ease: "linear" 
            }}
            className="absolute w-[800px] h-[800px] rounded-full bg-white/5 -bottom-40 -right-40"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/50 to-transparent" />
        </div>

        {/* Floating elements */}
        <div className="absolute inset-0">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="relative z-10 max-w-lg text-center px-10 text-primary-content"
        >
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="flex justify-center mb-8"
          >
            <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
              <Package size={52} className="drop-shadow-lg" />
            </div>
          </motion.div>

          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Smart Inventory
            <span className="block text-secondary">Management System</span>
          </h1>

          <p className="text-lg opacity-90 mb-10 leading-relaxed">
            Streamline your business operations with real-time inventory tracking,
            automated invoicing, and powerful analytics.
          </p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-4"
          >
            {[
              { icon: ShieldCheck, label: 'Enterprise Security', desc: '256-bit encryption' },
              { icon: Package, label: 'Live Inventory', desc: 'Real-time updates' },
              { icon: BarChart3, label: 'Smart Analytics', desc: 'AI-powered insights' },
            ].map((item, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                <item.icon className="mx-auto mb-3 w-8 h-8" />
                <p className="text-sm font-semibold mb-1">{item.label}</p>
                <p className="text-xs opacity-70">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Right Section - Enhanced form */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-base-200/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 p-8 backdrop-blur-xl">
            {/* Header */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-8"
            >
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.8 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-focus text-primary-content mb-4 shadow-lg"
              >
                <Package size={30} />
              </motion.div>

              <h2 className="text-3xl font-bold text-base-content mb-2">
                Welcome Back
              </h2>

              <p className="text-base-content/60">
                Sign in to continue to your dashboard
              </p>
            </motion.div>

            {/* Error Alert */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -20, height: 0 }}
                  className="mb-6"
                >
                  <Alert variant="error" title="Authentication Error">
                    <div className="flex items-center space-x-2">
                      <span>{error}</span>
                    </div>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Form */}
            <form 
              id="login-form"
              onSubmit={handleSubmit(onSubmit)} 
              className="space-y-6"
            >
              {/* Email Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <label className="block text-sm font-medium mb-2 text-base-content/80">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40 group-focus-within:text-primary transition-colors" />
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    className="pl-12"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Please enter a valid email address',
                      },
                    })}
                  />
                  {watchEmail && !errors.email && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-success"
                    >
                      ✓
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <label className="block text-sm font-medium mb-2 text-base-content/80">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40 group-focus-within:text-primary transition-colors" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    className="pl-12 pr-12"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </motion.button>
                </div>
              </motion.div>

              {/* Remember Me & Forgot Password */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex justify-between items-center text-sm"
              >
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="checkbox checkbox-primary checkbox-sm"
                  />
                  <span className="ml-2 text-base-content/70 group-hover:text-base-content transition-colors">
                    Remember me
                  </span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-primary hover:text-primary-focus hover:underline transition-all"
                >
                  Forgot Password?
                </Link>
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={loading}
                  disabled={!isValid || loading}
                  className="h-12 text-base font-semibold relative group overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center space-x-2">
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-focus to-primary transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </Button>
              </motion.div>
            </form>

            {/* Social Login */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8"
            >
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-base-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-base-100 text-base-content/60">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleSocialLogin('Google')}
                  className="h-12 relative group"
                >
                  <Chrome className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Google
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => handleSocialLogin('GitHub')}
                  className="h-12 relative group"
                >
                  <Github className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  GitHub
                </Button>
              </div>
            </motion.div>

            {/* Sign Up Link */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-center text-base-content/60 mt-8"
            >
              New to our platform?{' '}
              <Link
                to="/register"
                className="text-primary font-semibold hover:text-primary-focus hover:underline transition-all"
              >
                Create an account
              </Link>
            </motion.p>
          </div>
        </motion.div>
      </motion.div>

      {/* Custom styles for shake animation */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Login;