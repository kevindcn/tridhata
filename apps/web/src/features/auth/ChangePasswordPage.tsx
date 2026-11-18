import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth, ApiError } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';

const formSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: 'Kata sandi saat ini wajib diisi' }),
    newPassword: z
      .string()
      .min(10, { message: 'Kata sandi baru minimal 10 karakter' })
      .regex(/[A-Za-z]/, { message: 'Kata sandi baru harus mengandung huruf' })
      .regex(/[0-9]/, { message: 'Kata sandi baru harus mengandung angka' }),
    confirmPassword: z
      .string()
      .min(1, { message: 'Konfirmasi kata sandi wajib diisi' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Kata sandi baru harus berbeda dari kata sandi saat ini',
    path: ['newPassword'],
  });

type FormValues = z.infer<typeof formSchema>;

export const ChangePasswordPage: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setErrorMessage(null);
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      navigate('/penjualan', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(
          err.body?.message || 'Gagal mengubah kata sandi.',
        );
      } else {
        setErrorMessage('Terjadi kendala jaringan. Silakan coba kembali.');
      }
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Perbarui Kata Sandi
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {user?.mustChangePassword
              ? 'Anda wajib membuat kata sandi baru sebelum dapat menggunakan sistem.'
              : 'Perbarui kata sandi akun Anda secara berkala demi keamanan.'}
          </p>
        </div>

        <Card className="border border-border/80 shadow-xs bg-card">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold">Formulir Kata Sandi</CardTitle>
            <CardDescription className="text-xs">
              Kata sandi baru minimal 10 karakter serta mengandung huruf dan angka.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword" className="text-xs">
                  Kata Sandi Saat Ini / Sementara
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  {...register('currentPassword')}
                />
                {errors.currentPassword && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.currentPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs">
                  Kata Sandi Baru
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  {...register('newPassword')}
                />
                {errors.newPassword && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs">
                  Konfirmasi Kata Sandi Baru
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Simpan Kata Sandi Baru
                    </>
                  )}
                </Button>

                {user?.mustChangePassword && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => logout()}
                  >
                    Keluar dari Sesi
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
