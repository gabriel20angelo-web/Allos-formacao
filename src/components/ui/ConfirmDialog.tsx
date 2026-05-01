"use client";

import { type ReactNode } from "react";
import Modal from "./Modal";
import Button from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  /** Texto do botão de confirmação. Default: "Confirmar". */
  confirmLabel?: string;
  /** Texto do botão de cancelar. Default: "Cancelar". */
  cancelLabel?: string;
  /** Visual do botão de confirmação. Default: "primary". */
  variant?: "primary" | "danger";
  /** Estado de loading no botão de confirm (bloqueia clique). */
  loading?: boolean;
  /** Conteúdo extra renderizado entre a description e os botões. */
  children?: ReactNode;
}

/**
 * Diálogo de confirmação padrão (Modal + texto + Cancelar/Confirmar).
 * Use quando precisar perguntar "tem certeza?" antes de uma ação.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary",
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {description && (
          <div className="text-sm text-cream/50">{description}</div>
        )}
        {children}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
