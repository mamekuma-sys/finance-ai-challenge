"use client";

import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from "react-aria-components";

export function EvidenceDrawer({ children }: { children: ReactNode }) {
  return (
    <DialogTrigger>
      <Button className="btn btn-small evidence-drawer-trigger" aria-label="증거 근거 열기">
        증거 근거
      </Button>
      <ModalOverlay className="evidence-drawer-overlay" isDismissable>
        <Modal className="evidence-drawer-modal">
          <Dialog className="evidence-drawer-dialog" aria-label="증거 근거">
            {({ close }) => (
              <>
                <header className="evidence-drawer-head">
                  <strong>증거 근거</strong>
                  <Button className="btn btn-small" onPress={close} aria-label="증거 근거 닫기">
                    닫기
                  </Button>
                </header>
                <div className="evidence-drawer-body">{children}</div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
