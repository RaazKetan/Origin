import React, { useState } from "react";

const API_BASE = "http://localhost:8000";

export const AuthForm = ({ view, setView, onLogin, onRegister }) => {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    await onLogin(loginData);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    await onRegister(registerData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#E7ECEF]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-[#274C77] mb-2">
            Skill Link
          </h1>
          <p className="text-xl text-[#8B8C89]">
            Connect with developers and discover amazing opportunities
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#A3CEF1]">
          <div className="flex mb-6 bg-[#E7ECEF] rounded-xl p-1">
            <button
              className={`flex-1 py-3 px-6 rounded-lg transition-all duration-300 ${
                view === "login"
                  ? "bg-white text-[#274C77] shadow-sm"
                  : "text-[#8B8C89] hover:text-[#274C77]"
              }`}
              onClick={() => setView("login")}
            >
              Login
            </button>
            <button
              className={`flex-1 py-3 px-6 rounded-lg transition-all duration-300 ${
                view === "register"
                  ? "bg-white text-[#274C77] shadow-sm"
                  : "text-[#8B8C89] hover:text-[#274C77]"
              }`}
              onClick={() => setView("register")}
            >
              Register
            </button>
          </div>

          {view === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={loginData.email}
                onChange={(e) =>
                  setLoginData({ ...loginData, email: e.target.value })
                }
                className="w-full px-4 py-3 bg-[#F9FBFC] border border-[#A3CEF1] rounded-xl text-[#274C77] placeholder-[#8B8C89] focus:outline-none focus:ring-2 focus:ring-[#6096BA]"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginData.password}
                onChange={(e) =>
                  setLoginData({ ...loginData, password: e.target.value })
                }
                className="w-full px-4 py-3 bg-[#F9FBFC] border border-[#A3CEF1] rounded-xl text-[#274C77] placeholder-[#8B8C89] focus:outline-none focus:ring-2 focus:ring-[#6096BA]"
                required
              />
              <button
                type="submit"
                className="w-full py-3 bg-[#274C77] text-white font-semibold rounded-xl hover:bg-[#6096BA] transition-colors"
              >
                Login
              </button>
              <p className="text-center text-[#8B8C89] text-sm mt-4">
                Demo credentials:
                <br />
                alex@example.com / password123
                <br />
                sarah@example.com / password123
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={registerData.username}
                onChange={(e) =>
                  setRegisterData({ ...registerData, username: e.target.value })
                }
                className="w-full px-4 py-3 bg-[#F9FBFC] border border-[#A3CEF1] rounded-xl text-[#274C77] placeholder-[#8B8C89] focus:outline-none focus:ring-2 focus:ring-[#6096BA]"
                required
              />
              <input
                type="text"
                placeholder="Full Name"
                value={registerData.name}
                onChange={(e) =>
                  setRegisterData({ ...registerData, name: e.target.value })
                }
                className="w-full px-4 py-3 bg-[#F9FBFC] border border-[#A3CEF1] rounded-xl text-[#274C77] placeholder-[#8B8C89] focus:outline-none focus:ring-2 focus:ring-[#6096BA]"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={registerData.email}
                onChange={(e) =>
                  setRegisterData({ ...registerData, email: e.target.value })
                }
                className="w-full px-4 py-3 bg-[#F9FBFC] border border-[#A3CEF1] rounded-xl text-[#274C77] placeholder-[#8B8C89] focus:outline-none focus:ring-2 focus:ring-[#6096BA]"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={registerData.password}
                onChange={(e) =>
                  setRegisterData({ ...registerData, password: e.target.value })
                }
                className="w-full px-4 py-3 bg-[#F9FBFC] border border-[#A3CEF1] rounded-xl text-[#274C77] placeholder-[#8B8C89] focus:outline-none focus:ring-2 focus:ring-[#6096BA]"
                required
              />
              <button
                type="submit"
                className="w-full py-3 bg-[#274C77] text-white font-semibold rounded-xl hover:bg-[#6096BA] transition-colors"
              >
                Register
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
