"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z.string().email("يرجى إدخال إيميل صحيح"),
  password: z.string().min(4, "كلمة السر قصيرة جدًا"),
});

type LoginData = z.infer<typeof loginSchema>;

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginData) => {
    try {
      const res = await apiFetch<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });

      // Store token securely (localStorage for now)
      localStorage.setItem("access_token", res.access_token);
       toast.success("تم تسجيل الدخول بنجاح!");
      router.push("/dashboard"); // redirect to dashboard
    } catch (error: any) {
      console.error(error);
      toast.error("فشل تسجيل الدخول. تأكد من البيانات.");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="p-6 md:p-8 space-y-4"
          >
            <div className="flex flex-col items-center gap-2 text-center mb-6">
              <h1 className="text-2xl font-bold">سلام ونعمة</h1>
              <p className="text-muted-foreground text-balance">
                سجل الدخول لحسابك
              </p>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">الإيميل</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  {...register("email")}
                  required
                />
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">كلمة السر</FieldLabel>
                  
                </div>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  required
                />
              </Field>

              <Field>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "جارٍ الدخول..." : "تسجيل الدخول"}
                </Button>
              </Field>
            </FieldGroup>
          </form>

          <div className="relative hidden md:block">
            <img
              src="/logo.png"
              alt="Image"
              className="absolute inset-0 p-4 h-full w-full object-cover dark:brightness-[0.8] "
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
