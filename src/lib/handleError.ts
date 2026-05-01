import { toast } from "sonner";
import { logger } from "./logger";

/**
 * Padrão de tratamento: loga estruturado + toast pro usuário.
 *
 * Use no catch:
 *   try { ... } catch (err) { handleError("[meu-flow]", err, "Falha ao salvar"); }
 *
 * Por que: garante que toda falha tem (1) log na console com prefixo
 * (pra o dev achar) e (2) feedback visual (pro usuário não ficar no
 * vácuo). Sem isso, o app falha em silêncio e o usuário acha que
 * travou.
 */
export function handleError(
  prefix: string,
  err: unknown,
  toastMessage?: string
) {
  logger.error(prefix, err);
  const fallback =
    toastMessage ||
    (err instanceof Error ? err.message : "Algo deu errado.");
  toast.error(fallback);
}
