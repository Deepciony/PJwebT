import { useEffect, useState } from 'react';
import { Button, Modal } from '../components/ui';

// Custom replacement for window.confirm (browser dialogs look broken and can't be styled).
// One dialog mounted once in Layout; confirm() anywhere returns a promise like window.confirm would.
type Req = { message: string; title: string; danger?: boolean; resolve: (ok: boolean) => void } | null;
let setReq: ((r: Req) => void) | null = null;

export function confirm(message: string, opts?: { title?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => setReq?.({ message, title: opts?.title ?? 'ยืนยัน', danger: opts?.danger ?? true, resolve }));
}

export function ConfirmHost() {
  const [req, set] = useState<Req>(null);
  useEffect(() => {
    setReq = set;
    return () => {
      setReq = null;
    };
  }, []);
  const close = (ok: boolean) => {
    req?.resolve(ok);
    set(null);
  };
  return (
    <Modal open={req !== null} onClose={() => close(false)} title={req?.title ?? 'ยืนยัน'}>
      <div className="space-y-4">
        <p>{req?.message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={() => close(false)}>
            ยกเลิก
          </Button>
          <Button variant={req?.danger ? 'quiet-danger' : 'primary'} onClick={() => close(true)}>
            ตกลง
          </Button>
        </div>
      </div>
    </Modal>
  );
}
