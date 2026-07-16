import { useCallback, useRef, useState } from "react";
import { Upload, Camera, FileText, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  onFile: (file: File) => void;
  onClear?: () => void;
  disabled?: boolean;
  currentFile?: File | null;
  multiple?: boolean;
}

const MAX_SIZE = 15 * 1024 * 1024;

export function UploadArea({ onFile, onClear, disabled, currentFile, multiple }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      setError(null);
      const okType = /pdf$|jpg$|jpeg$|png$/i.test(file.name) || ["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(file.type);
      if (!okType) {
        setError("Formato não suportado. Envie PDF, JPG ou PNG.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setError("Arquivo maior que 15 MB.");
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  const handleList = useCallback(
    (files: FileList | null | undefined) => {
      if (!files) return;
      Array.from(files).forEach((f) => handle(f));
    },
    [handle],
  );

  return (
    <div className="w-full">
      {currentFile ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {currentFile.type.includes("pdf") ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{currentFile.name}</p>
              <p className="text-xs text-muted-foreground">{(currentFile.size / 1024).toFixed(0)} KB</p>
            </div>
          </div>
          {onClear && !disabled && (
            <Button size="sm" variant="ghost" onClick={onClear} aria-label="Remover arquivo">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (multiple) handleList(e.dataTransfer.files);
            else handle(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer sm:p-12",
            dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-primary/[0.02]",
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Upload className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-medium text-foreground">{multiple ? "Arraste um ou mais boletos aqui" : "Arraste o boleto aqui"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{multiple ? "envie vários arquivos de uma vez" : "ou selecione um arquivo do seu dispositivo"}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <Upload className="mr-2 h-4 w-4" /> {multiple ? "Selecionar boletos" : "Selecionar boleto"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                cameraRef.current?.click();
              }}
            >
              <Camera className="mr-2 h-4 w-4" /> Usar câmera
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">PDF, JPG ou PNG — até 15 MB</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/jpg"
        multiple={multiple}
        hidden
        onChange={(e) => (multiple ? handleList(e.target.files) : handle(e.target.files?.[0]))}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}