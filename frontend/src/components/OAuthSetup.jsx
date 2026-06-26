import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const OAuthSetup = ({ setupToken, onComplete }) => {
  const [username, setUsername] = useState("");
  const [isAvailable, setIsAvailable] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!username) {
      setIsAvailable(null);
      setError(null);
      return;
    }

    const checkUsername = async () => {
      setIsChecking(true);
      try {
        const res = await fetch(`${API_BASE}/users/check-username?username=${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          setIsAvailable(data.available);
          if (!data.available) {
            setError("Username is already taken");
          } else {
            setError(null);
          }
        }
      } catch (err) {
        console.error("Error checking username:", err);
      } finally {
        setIsChecking(false);
      }
    };

    const debounceTimer = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounceTimer);
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !isAvailable) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/complete-oauth-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setup_token: setupToken,
          username: username,
          email: "placeholder@email.com", // Backend verifies the real one from token
          name: "Placeholder", // Backend uses token name
          password: "" // Backend generates random password
        })
      });

      if (res.ok) {
        const data = await res.json();
        onComplete(data.access_token);
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to complete signup");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#E7ECEF] dark:bg-[#0a0a0a]">
      <div className="w-full max-w-md bg-white dark:bg-[#1a1a1c] rounded-2xl p-8 shadow-lg border border-[#A3CEF1] dark:border-white/5">
        <h2 className="text-2xl font-bold text-[#274C77] dark:text-white mb-2">Choose a Username</h2>
        <p className="text-[#8B8C89] dark:text-zinc-400 mb-6">You're almost there! Pick a unique username for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              }}
              className={`w-full px-4 py-3 bg-[#F9FBFC] dark:bg-black border rounded-xl text-[#274C77] dark:text-white placeholder-[#8B8C89] focus:outline-none focus:ring-2 focus:ring-[#6096BA] ${
                error ? 'border-red-500' : isAvailable ? 'border-green-500' : 'border-[#A3CEF1] dark:border-white/10'
              }`}
              required
              minLength={3}
              maxLength={30}
            />
            
            {isChecking && <p className="text-sm text-gray-500 mt-1">Checking availability...</p>}
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            {isAvailable && !isChecking && username && (
              <p className="text-sm text-green-500 mt-1">Username is available!</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isAvailable || isChecking || isSubmitting}
            className={`w-full py-3 text-white font-semibold rounded-xl transition-colors ${
              !isAvailable || isChecking || isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#274C77] hover:bg-[#6096BA]'
            }`}
          >
            {isSubmitting ? 'Creating account...' : 'Complete Signup'}
          </button>
        </form>
      </div>
    </div>
  );
};
