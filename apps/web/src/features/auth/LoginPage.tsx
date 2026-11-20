import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginDto, loginSchema } from '@tridhata/shared';
import { useAuth, ApiError } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import tridhataLogo from '@/components/img/tridahata logo.png';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginDto) => {
    setErrorMessage(null);
    try {
      await login(data);
      const from =
        (location.state as { from?: { pathname: string } })?.from?.pathname ||
        '/penjualan';
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(
          err.body?.message ||
            'Gagal masuk. Periksa kembali email dan kata sandi Anda.',
        );
      } else {
        setErrorMessage('Terjadi kendala jaringan. Silakan coba kembali.');
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f4f7f5] flex items-center justify-center p-4 selection:bg-emerald-200">
      {/* ============================================================ */}
      {/* 1. LATAR BELAKANG: LENGKUNGAN ORGANIK HIJAU (SISI KANAN)     */}
      {/* ============================================================ */}
      <svg
        className="pointer-events-none absolute right-0 top-0 h-full w-[45vw] min-w-[340px] max-w-[700px] z-0 select-none"
        viewBox="0 0 500 900"
        fill="none"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Layer 1: Lengkungan hijau mint lembut transparan */}
        <path
          d="M100 0C170 260 80 520 210 900H500V0H100Z"
          fill="#cbe3d4"
          fillOpacity="0.4"
        />
        {/* Layer 2: Lengkungan sage green lembut */}
        <path
          d="M180 0C250 280 150 560 290 900H500V0H180Z"
          fill="#78ab8b"
          fillOpacity="0.55"
        />
        {/* Layer 3: Lengkungan hijau emerald mid */}
        <path
          d="M260 0C330 300 220 600 350 900H500V0H260Z"
          fill="#176a3e"
        />
        {/* Layer 4: Lengkungan hijau hutan terdalam */}
        <path
          d="M340 0C400 310 310 630 420 900H500V0H340Z"
          fill="#0c3821"
        />
      </svg>

      {/* ============================================================ */}
      {/* 2. LATAR BELAKANG: AKSEN DEDAUNAN TROPIS (SISI KIRI)         */}
      {/* ============================================================ */}
      {/* Dedaunan samar di pojok kiri atas */}
      <div
        className="pointer-events-none absolute -top-12 -left-12 w-80 h-80 z-0 opacity-20 select-none"
        style={{ filter: 'blur(3px)' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M-20 -20C40 30 90 90 120 180M-20 -20C30 50 60 110 80 180M-20 -20C60 20 120 60 180 90M-20 -20C80 0 140 30 190 50"
            stroke="#1b5e37"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Daun-daun palem */}
          <path
            d="M30 40Q60 70 80 120Q50 90 30 40Z M70 50Q110 80 140 120Q100 90 70 50Z M90 20Q130 40 170 70Q120 45 90 20Z"
            fill="#23663e"
          />
        </svg>
      </div>

      {/* Dedaunan monstera/palem di pojok kiri bawah dengan efek kedalaman (blur) */}
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 w-80 sm:w-96 h-80 sm:h-96 z-0 opacity-80 select-none"
        style={{ filter: 'blur(4px)' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Daun palem kiri bawah */}
          <path
            d="M0 300C30 220 90 170 170 130C100 170 60 230 0 300Z"
            fill="#1e5c38"
          />
          <path
            d="M0 260C40 200 110 160 210 130C140 160 80 210 0 260Z"
            fill="#2c7a4b"
          />
          <path
            d="M-20 220C40 180 130 150 240 140C160 160 90 200 -20 220Z"
            fill="#3d915f"
          />
          <path
            d="M0 320C60 260 130 220 230 200C160 230 90 270 0 320Z"
            fill="#17492c"
          />
        </svg>
      </div>

      {/* ============================================================ */}
      {/* 3. KONTEN UTAMA: LOGO & KARTU LOGIN                          */}
      {/* ============================================================ */}
      <div className="relative z-10 w-full max-w-[430px] flex flex-col items-center">
        {/* Header Branding di atas kartu */}
        <div className="flex flex-col items-center mb-6">
          <img
            src={tridhataLogo}
            alt="Tridhata Agro"
            className="h-20 sm:h-[84px] w-auto object-contain select-none drop-shadow-xs"
          />
        </div>

        {/* Kartu Formulir Masuk */}
        <div className="w-full bg-white rounded-[26px] p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(10,59,34,0.08),0_10px_20px_-5px_rgba(0,0,0,0.03)] border border-[#e8efe9]">
          {/* Garis aksen hijau horizontal di atas judul */}
          <div className="w-10 h-1 bg-gradient-to-r from-[#0b5e34] to-[#1e7c48] rounded-full mb-5" />

          {/* Judul & Keterangan */}
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Masuk ke Akun
          </h1>
          <p className="text-xs sm:text-sm text-[#6b7280] mt-1 mb-6">
            Akses sistem internal Tridhata Agro
          </p>

          {/* Banner Galat jika gagal masuk */}
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive leading-relaxed font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulir */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Field Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold text-[#374151]"
              >
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@tridhata.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  className="pl-10 pr-4 h-11 rounded-xl border-[#e5e7eb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus-visible:ring-2 focus-visible:ring-[#0b5e34]/20 focus-visible:border-[#0b5e34] transition-all bg-white"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive mt-1 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Field Kata Sandi */}
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-[#374151]"
              >
                Kata Sandi
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  className="pl-10 pr-10 h-11 rounded-xl border-[#e5e7eb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus-visible:ring-2 focus-visible:ring-[#0b5e34]/20 focus-visible:border-[#0b5e34] transition-all bg-white"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#4b5563] focus:outline-none transition-colors"
                  aria-label={
                    showPassword
                      ? 'Sembunyikan kata sandi'
                      : 'Tampilkan kata sandi'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive mt-1 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Tombol Masuk */}
            <Button
              type="submit"
              className="w-full !mt-6 h-11 rounded-xl bg-[#0b5e34] hover:bg-[#084828] active:bg-[#063a20] text-white font-medium text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
