import React, { useEffect } from "react";
import { notification } from "antd";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../../config/firebase.config";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../hook/useTranslation";

const Login = () => {
  const { loginGoogle, loginWithUsername, token, userInfo, role } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    username: "",
    password: "",
  });
  const [errors, setErrors] = React.useState({});

  useEffect(() => {
    if (token && (role || userInfo)) {
      let userRole = role || userInfo?.role;
      if (Array.isArray(userRole)) userRole = userRole[0];
      userRole = String(userRole || "")
        .toLowerCase()
        .replace(/^role[_-]?/i, "");

      switch (userRole) {
        case "admin":
          navigate("/admin/dashboard", { replace: true });
          break;
        case "mentor":
          navigate("/mentor/dashboard", { replace: true });
          break;
        case "moderator":
          navigate("/moderator/dashboard", { replace: true });
          break;
        default:
          navigate("/", { replace: true });
      }
    }
  }, [token, userInfo, role, navigate]);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      const idToken = await fbUser.getIdToken();

      const userData = await loginGoogle(idToken);

      notification.success({ message: t("signedInWithGoogle") });

      let userRole = userData?.role;
      if (Array.isArray(userRole)) userRole = userRole[0];
      userRole = String(userRole || "")
        .toLowerCase()
        .replace(/^role[_-]?/i, "");

      switch (userRole) {
        case "admin":
          navigate("/admin/dashboard");
          break;
        case "mentor":
          navigate("/mentor/dashboard");
          break;
        case "moderator":
          navigate("/moderator/dashboard");
          break;
        default:
          navigate("/");
      }
    } catch (error) {
      notification.error({
        message: t("signInFailed"),
        description: error?.message || t("pleaseTryAgain"),
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUsernameLogin = async (e) => {
    e.preventDefault();
    if (loading || !validateForm()) return;
    setLoading(true);

    try {
      const userData = await loginWithUsername(
        formData.username,
        formData.password,
      );

      notification.success({ message: "Đăng nhập thành công!" });

      let userRole = userData?.role;
      if (Array.isArray(userRole)) userRole = userRole[0];
      userRole = String(userRole || "")
        .toLowerCase()
        .replace(/^role[_-]?/i, "");

      switch (userRole) {
        case "admin":
          navigate("/admin/dashboard");
          break;
        case "mentor":
          navigate("/mentor/dashboard");
          break;
        case "moderator":
          navigate("/moderator/dashboard");
          break;
        default:
          navigate("/");
      }
    } catch (error) {
      notification.error({
        message: "Đăng nhập thất bại",
        description: error?.message || "Vui lòng thử lại",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Animated Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-10 relative z-10 animate-fadeIn">
        <div className="text-5xl font-black tracking-tight mt-10">Teammy.</div>
        <div className="mt-2 text-sm font-medium text-gray-600">
          Collaborative workspace for teams
        </div>
      </div>

      {/* Main box */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 px-10 py-12 space-y-8 relative z-10 animate-slideUp">
        {/* Shine effect */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-200%] animate-shine"></div>

        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-gray-600 text-base font-medium">
            Sign in to your account to access Teammy
          </p>
        </div>

        {/* Fixed Campus Display */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl px-5 py-4 border border-indigo-100">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <div className="text-sm">
              <span className="font-semibold text-gray-500">Campus:</span>{" "}
              <span className="font-bold text-gray-900">FU-Hồ Chí Minh</span>
            </div>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleUsernameLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 ${
                errors.username ? "border-red-400" : "border-gray-200"
              } focus:border-indigo-400 focus:outline-none transition-colors`}
              placeholder="your.username"
            />
            {errors.username && (
              <p className="mt-1 text-xs text-red-500">{errors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 ${
                errors.password ? "border-red-400" : "border-gray-200"
              } focus:border-indigo-400 focus:outline-none transition-colors`}
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl py-4 px-6 font-bold hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </span>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white/80 text-gray-500 font-medium">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="group w-full bg-white border-2 border-gray-200 rounded-2xl py-4 px-6 flex items-center justify-center gap-3 font-bold text-gray-800 hover:border-indigo-400 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
        >
          {/* Button hover gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>

          <div className="relative flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <span className="text-base font-bold">Continue with Google</span>
          </div>
        </button>

        <div className="text-center text-xs text-gray-500 space-y-1 pt-2">
          <p className="font-medium">
            By continuing, you agree to Teammy's{" "}
            <span className="text-indigo-600 hover:text-indigo-700 cursor-pointer underline-offset-2 hover:underline">
              terms of use
            </span>
          </p>
        </div>
      </div>

      {/* Footer text */}
      <div className="mt-8 text-center text-sm text-gray-500 relative z-10 animate-fadeIn animation-delay-200">
        <p className="font-medium">Need help? Contact support team</p>
      </div>
    </div>
  );
};

export default Login;
