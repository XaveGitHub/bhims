import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "../lib/utils.ts"
import { Button } from "../components/ui/button.tsx"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field.tsx"
import { Input } from "../components/ui/input.tsx"
import { login, setClientAuth } from "../lib/auth-service.ts"
import { Loader2 } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // Validation states
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setUsernameError("");
    setPasswordError("");
    setGeneralError("");
    
    let hasError = false;
    if (!username.trim()) {
      setUsernameError("Username is required");
      hasError = true;
    }
    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    }
    
    if (hasError) return;

    setLoading(true);

    try {
      const res = await login({ data: { username, password } });
      if (res.success) {
        setClientAuth(true);
        navigate({ to: "/" });
      } else {
        setGeneralError(res.error || "Invalid credentials");
      }
    } catch (err) {
      setGeneralError("An error occurred. Please try again.");
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
            <div className="absolute inset-0 bg-emerald-500/30 blur-xl rounded-full scale-150 z-0 animate-pulse" />
            <img src="/barangay_logo.png" alt="Barangay Logo" className="relative z-10 w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-[0.15em] text-white drop-shadow-sm leading-none pt-2">BHIMS</h1>
        </div>
        
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input 
            id="username" 
            type="text" 
            placeholder="" 
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError("");
              if (generalError) setGeneralError("");
            }}
            className={cn(usernameError && "border-red-500 focus-visible:ring-red-500")}
            autoFocus
          />
          {usernameError && <p className="text-xs text-red-500 font-medium mt-1">{usernameError}</p>}
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input 
            id="password" 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError("");
              if (generalError) setGeneralError("");
            }}
            className={cn(passwordError && "border-red-500 focus-visible:ring-red-500")}
          />
          {passwordError && <p className="text-xs text-red-500 font-medium mt-1">{passwordError}</p>}
          {generalError && <p className="text-sm text-red-500 font-medium text-center mt-2">{generalError}</p>}
        </Field>
        
        <Field className="pt-2">
          <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
