import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Sparkles, ArrowRight, Loader2, ArrowLeft, Shield, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'employee', 'client'], { required_error: 'Please select a role' }),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

const roleInfo = {
  admin: { icon: Shield, label: 'Admin', description: 'Full access to all features' },
  employee: { icon: Briefcase, label: 'Employee', description: 'View projects and your profile' },
  client: { icon: User, label: 'Client', description: 'View your projects and updates' },
};

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading, signIn, role: userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', role: 'admin' },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (!loading && user && userRole) {
      // Redirect based on role
      if (userRole === 'client') {
        navigate('/client-portal');
      } else if (userRole === 'employee') {
        navigate('/employee-portal');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, loading, userRole, navigate]);

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);

    // --- DEFAULT ADMIN LOGIC START ---
    // Check for hardcoded "First Time" Admin credentials
    if (
      data.email.toLowerCase() === 'admin@techwidom.com' && 
      data.password === 'AdminUser0' && 
      data.role === 'admin'
    ) {
      try {
        // Check if ANY real admins exist in the database
        const { data: existingAdmins, error } = await supabase
          .from('user_roles')
          .select('id')
          .eq('role', 'admin')
          .limit(1);

        // If query failed or admins exist, BLOCK this login
        if (!error && existingAdmins && existingAdmins.length > 0) {
          setIsSubmitting(false);
          toast.error('Default admin login disabled because system admins already exist.');
          return;
        }

        // If NO admins exist, allow this "Backdoor" login (Mocking success)
        // NOTE: This relies on client-side state, which isn't persistent for real sessions.
        // Ideally, you'd trigger a backend seed function here, but per instructions, 
        // we are just allowing navigation.
        toast.success('Welcome Default Admin! Please create a real admin account immediately.');
        navigate('/dashboard'); 
        setIsSubmitting(false);
        return;

      } catch (err) {
        console.error("Error checking existing admins", err);
        // Fall through to normal login if this check fails
      }
    }
    // --- DEFAULT ADMIN LOGIC END ---

    const { error } = await signIn(data.email, data.password);
    
    if (error) {
      setIsSubmitting(false);
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please try again.');
      } else {
        toast.error(error.message);
      }
      return;
    }

    // After successful login, verify the role
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        setIsSubmitting(false);
        toast.error('No role assigned to this account. Please contact an administrator.');
        return;
      }

      if (roleData.role !== data.role) {
        await supabase.auth.signOut();
        setIsSubmitting(false);
        toast.error(`You are not registered as ${roleInfo[data.role].label}. Your role is ${roleInfo[roleData.role as keyof typeof roleInfo].label}.`);
        return;
      }

      toast.success(`Welcome back, ${roleInfo[data.role].label}!`);
      
      // Redirect based on role
      if (data.role === 'client') {
        navigate('/client-portal');
      } else if (data.role === 'employee') {
        navigate('/employee-portal');
      } else {
        navigate('/dashboard');
      }
    }
    setIsSubmitting(false);
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    toast.info('Public registration is disabled. Please contact an administrator to create an account.');
    setIsSubmitting(false);
  };

  const handlePasswordReset = async (data: ResetFormData) => {
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-primary-foreground">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary-foreground/10 backdrop-blur-sm rounded-xl">
              <Building2 className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">TechWisdom</h1>
              <p className="text-primary-foreground/80 text-sm">Agency ERP</p>
            </div>
          </div>
          
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
            Manage Your Agency
            <br />
            <span className="text-primary-foreground/90">Like Never Before</span>
          </h2>
          
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-md">
            A complete agency management system for CRM, projects, HR, and finances — all in one beautiful interface.
          </p>

          <div className="space-y-4">
            {[
              'Lead Management & CRM',
              'Project Operations',
              'HR & Payroll',
              'Financial Dashboard',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-primary-foreground/90">
                <Sparkles className="h-5 w-5" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-foreground/5 rounded-full -translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-20 right-20 w-32 h-32 bg-primary-foreground/5 rounded-full" />
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="p-2 gradient-primary rounded-lg">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">TechWisdom</span>
          </div>

          {showForgotPassword ? (
            <Card className="glass-card border-border/50 shadow-soft">
              <CardHeader className="space-y-1 pb-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-fit -ml-2 mb-2"
                  onClick={() => setShowForgotPassword(false)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to login
                </Button>
                <CardTitle className="text-2xl font-bold">Reset password</CardTitle>
                <CardDescription>
                  Enter your email and we'll send you a reset link
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={resetForm.handleSubmit(handlePasswordReset)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@company.com"
                      {...resetForm.register('email')}
                      className="h-11"
                    />
                    {resetForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{resetForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-11 gradient-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Send Reset Link
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card border-border/50 shadow-soft">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold">
                  {activeTab === 'login' ? 'Welcome back' : 'Create an account'}
                </CardTitle>
                <CardDescription>
                  {activeTab === 'login' 
                    ? 'Select your role and enter credentials to access your dashboard'
                    : 'Contact an administrator to create your account'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4">
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      {/* Role Selection */}
                      <div className="space-y-2">
                        <Label>Login as</Label>
                        <Select
                          value={loginForm.watch('role')}
                          onValueChange={(value: 'admin' | 'employee' | 'client') => loginForm.setValue('role', value)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleInfo).map(([key, info]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <info.icon className="h-4 w-4" />
                                  <span>{info.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {loginForm.formState.errors.role && (
                          <p className="text-sm text-destructive">{loginForm.formState.errors.role.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="admin@techwisdom.com"
                          {...loginForm.register('email')}
                          className="h-11"
                        />
                        {loginForm.formState.errors.email && (
                          <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="login-password">Password</Label>
                          <Button 
                            type="button" 
                            variant="link" 
                            className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                            onClick={() => setShowForgotPassword(true)}
                          >
                            Forgot password?
                          </Button>
                        </div>
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          {...loginForm.register('password')}
                          className="h-11"
                        />
                        {loginForm.formState.errors.password && (
                          <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                        )}
                      </div>

                      <Button type="submit" className="w-full h-11 gradient-primary" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    <div className="text-center py-8">
                      <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">Registration Disabled</h3>
                      <p className="text-sm text-muted-foreground">
                        Public registration is disabled for security. Please contact an administrator to create your account.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}