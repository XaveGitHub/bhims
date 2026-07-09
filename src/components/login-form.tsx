import { useState } from "react"

import { cn } from "../lib/utils.ts"
import { Button } from "../components/ui/button.tsx"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field.tsx"
import { Input } from "../components/ui/input.tsx"
import { login } from "../lib/auth-service.ts"
import { clearClientAuth } from "../lib/client-auth.ts"
import { Loader2 } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // Validation states
  const [usernameError, setUsernameError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [generalError, setGeneralError] = useState("");
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setUsernameError(false);
    setPasswordError(false);
    setGeneralError("");
    
    const missingUsername = !username.trim();
    const missingPassword = !password;

    if (missingUsername || missingPassword) {
      setUsernameError(missingUsername);
      setPasswordError(missingPassword);
      if (missingUsername && missingPassword) {
        setGeneralError("Username and password are required");
      } else if (missingUsername) {
        setGeneralError("Username is required");
      } else {
        setGeneralError("Password is required");
      }
      return;
    }

    setLoading(true);

    try {
      const res = await login({ data: { username, password } });
      if (res.success) {
        clearClientAuth();
        window.location.href = "/";
      } else {
        setGeneralError(res.error || "Invalid credentials");
        setUsername("");
        setPassword(""); // Clear password on error
      }
    } catch (err) {
      setGeneralError("An error occurred. Please try again.");
      setUsername("");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} noValidate {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center text-center -mb-2">
          <div className="relative">
            {/* Green glowing background behind the logo */}
            <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full scale-150 z-0 animate-pulse" />
            <img src="/barangay_logo.png" alt="Barangay Logo" className="relative z-10 w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-[0.15em] text-white drop-shadow-sm leading-none pt-2">BHIMS</h1>
        </div>
        
        {generalError && (
          <p className="text-sm text-red-500 font-medium text-center">
            {generalError}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="username" className={cn((usernameError || generalError) && "text-red-500")}>Username</FieldLabel>
          <Input 
            id="username" 
            type="text" 
            placeholder="" 
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError(false);
              if (generalError) setGeneralError("");
            }}
            className={cn((usernameError || generalError) && "border-red-500 text-red-500 focus-visible:ring-red-500")}
            autoFocus
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password" className={cn((passwordError || generalError) && "text-red-500")}>Password</FieldLabel>
          <Input 
            id="password" 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(false);
              if (generalError) setGeneralError("");
            }}
            className={cn((passwordError || generalError) && "border-red-500 text-red-500 focus-visible:ring-red-500")}
          />
        </Field>
        
        <Field className="pt-2">
          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
