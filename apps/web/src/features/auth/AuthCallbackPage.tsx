import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, ApiError } from './AuthContext';
import { Loader2 } from 'lucide-react';
import tridhataLogo from '@/components/img/tridahata logo.png';

export const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { loginWithTicket } = useAuth();
  const navigate = useNavigate();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const ticket = searchParams.get('ticket');
    const error = searchParams.get('error');

    if (error) {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error }, window.location.origin);
        window.close();
        return;
      }
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (!ticket) {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_ERROR', error: 'AUTH_FAILED' },
          window.location.origin,
        );
        window.close();
        return;
      }
      navigate('/login?error=AUTH_FAILED', { replace: true });
      return;
    }

    const exchange = async () => {
      try {
        await loginWithTicket(ticket);

        if (window.opener && window.opener !== window) {
          window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, window.location.origin);
          window.close();
          return;
        }

        navigate('/penjualan', { replace: true });
      } catch (err) {
        const errorCode =
          err instanceof ApiError && err.body?.code ? err.body.code : 'AUTH_FAILED';

        if (window.opener && window.opener !== window) {
          window.opener.postMessage(
            { type: 'GOOGLE_AUTH_ERROR', error: errorCode },
            window.location.origin,
          );
          window.close();
          return;
        }

        navigate(`/login?error=${encodeURIComponent(errorCode)}`, { replace: true });
      }
    };

    exchange();
  }, [searchParams, loginWithTicket, navigate]);

  return (
    <div className="min-h-screen w-full bg-[#f4f7f5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 border border-[#e8efe9] shadow-sm flex flex-col items-center text-center">
        <img
          src={tridhataLogo}
          alt="Tridhata Agro"
          className="h-16 w-auto object-contain select-none mb-6 drop-shadow-xs"
        />
        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#0b5e34]" />
        </div>
        <h2 className="text-lg font-semibold text-[#111827]">
          Memverifikasi Akun Google Anda
        </h2>
        <p className="text-xs text-[#6b7280] mt-1.5">
          Mohon tunggu sebentar selagi kami mengonfirmasi sesi Anda...
        </p>
      </div>
    </div>
  );
};
