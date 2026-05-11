"use client";

import {
  AlertCircle,
  Check,
  Copy,
  Database,
  Download,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CharacterProfile, CharacterRecord, SignedUploadIntent } from "@/lib/types";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "signing" | "uploading" | "uploaded" | "processing" | "done" | "failed";
};

type ViewMode = "library" | "upload";
type GenderFilter = "all" | "feminine" | "masculine" | "androgynous";
type AgeFilter = "all" | "18-29" | "30-39" | "40-49" | "50-59" | "60-plus";

const genderOptions: Array<{ label: string; value: GenderFilter }> = [
  { label: "All genders", value: "all" },
  { label: "Feminine", value: "feminine" },
  { label: "Masculine", value: "masculine" },
  { label: "Androgynous", value: "androgynous" }
];

const ageOptions: Array<{ label: string; value: AgeFilter }> = [
  { label: "All ages", value: "all" },
  { label: "18-29", value: "18-29" },
  { label: "30-39", value: "30-39" },
  { label: "40-49", value: "40-49" },
  { label: "50-59", value: "50-59" },
  { label: "60+", value: "60-plus" }
];
export default function Home() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selected, setSelected] = useState<CharacterRecord | null>(null);
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [activeView, setActiveView] = useState<ViewMode>("library");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const runSearch = useCallback(async () => {
    setSearching(true);
    setError("");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          gender: genderFilter,
          age: ageFilter
        })
      });
      const payload = await readJsonResponse<{ characters?: CharacterRecord[]; error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Search failed.");
      }

      const characters = Array.isArray(payload.characters) ? (payload.characters as CharacterRecord[]) : [];

      setCharacters(characters);
      setSelected((current) => {
        if (!current) {
          return characters[0] || null;
        }

        return characters.find((character) => character.id === current.id) || characters[0] || null;
      });
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setSearching(false);
      setLoading(false);
    }
  }, [query, genderFilter, ageFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      runSearch();
    }, 350);

    return () => window.clearTimeout(handle);
  }, [runSearch]);

  useEffect(() => {
    if (!characters.some((character) => character.status === "queued" || character.status === "processing")) {
      return;
    }

    const handle = window.setInterval(() => {
      runSearch();
    }, 8000);

    return () => window.clearInterval(handle);
  }, [characters, runSearch]);

  const handleCharacterDeleted = useCallback(
    (deletedId: string) => {
      const nextCharacters = characters.filter((character) => character.id !== deletedId);

      setCharacters(nextCharacters);
      setSelected((current) => (current?.id === deletedId ? nextCharacters[0] || null : current));
    },
    [characters]
  );

  return (
    <main className="grid min-h-screen grid-cols-[232px_minmax(0,1fr)] bg-background text-foreground max-lg:grid-cols-1">
      <aside className="flex flex-col gap-7 border-r bg-card px-4 py-6 max-lg:border-r-0 max-lg:border-b" aria-label="Primary">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground">V</div>
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-bold uppercase leading-none text-muted-foreground">Valid.co</p>
            <h1 className="text-[17px] font-semibold leading-tight">Character Library</h1>
          </div>
        </div>

        <nav className="grid gap-1 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Button
            variant={activeView === "library" ? "secondary" : "ghost"}
            className={cn("justify-start", activeView === "library" && "border border-border")}
            type="button"
            onClick={() => setActiveView("library")}
          >
            <Database />
            Library
          </Button>
          <Button
            variant={activeView === "upload" ? "secondary" : "ghost"}
            className={cn("justify-start", activeView === "upload" && "border border-border")}
            type="button"
            onClick={() => setActiveView("upload")}
          >
            <UploadCloud />
            Upload
          </Button>
        </nav>
      </aside>

      <section className="min-w-0">
        <header className="sticky top-0 z-10 grid min-h-[78px] grid-cols-[minmax(320px,1fr)_auto] items-center gap-3 border-b bg-card/90 px-6 py-4 backdrop-blur-xl max-md:grid-cols-1 max-sm:px-4">
          {activeView === "library" ? (
            <>
              <PageHeading
                eyebrow="Library"
                title="Character Library"
                description={loading ? "Loading reusable references" : `${characters.length} matching character${characters.length === 1 ? "" : "s"}`}
              />

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" type="button" onClick={runSearch}>
                  <RefreshCw className={cn(searching && "spin")} />
                  Refresh
                </Button>
              </div>
            </>
          ) : (
            <>
              <PageHeading eyebrow="Upload" title="Batch character intake" description="Drop one reference or a full batch. Analysis starts after upload." />
            </>
          )}
        </header>

        {error ? (
          <Alert variant="destructive" className="mx-6 mt-4 max-sm:mx-4">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section
          className={cn("w-full max-w-[1220px] px-6 py-4 max-sm:px-4", activeView !== "upload" && "hidden")}
          aria-hidden={activeView !== "upload"}
        >
            <UploadWorkbench onUploaded={runSearch} />
        </section>

        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_400px] items-start gap-4 px-6 py-4 max-xl:grid-cols-1 max-sm:px-4",
            activeView !== "library" && "hidden"
          )}
          aria-hidden={activeView !== "library"}
        >
            <section className="grid min-w-0 gap-5">
              <div className="grid grid-cols-[minmax(280px,1fr)_156px_156px] gap-2 max-md:grid-cols-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 pr-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="50 year old man black shirt"
                    aria-label="Search characters"
                  />
                  {searching ? <Loader2 className="spin absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /> : null}
                </div>

                <Select value={genderFilter} onValueChange={(value) => setGenderFilter(value as GenderFilter)}>
                  <SelectTrigger aria-label="Gender filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={ageFilter} onValueChange={(value) => setAgeFilter(value as AgeFilter)}>
                  <SelectTrigger aria-label="Age filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CharacterGrid characters={characters} selectedId={selected?.id} onSelect={setSelected} loading={loading} />
            </section>

            <CharacterDrawer character={selected} onDeleted={handleCharacterDeleted} />
          </div>
      </section>
    </main>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-bold uppercase leading-none text-muted-foreground">{eyebrow}</p>
      <h2 className="text-[22px] font-semibold leading-tight">{title}</h2>
      <span className="mt-1 block text-sm leading-snug text-muted-foreground">{description}</span>
    </div>
  );
}

function UploadWorkbench({ onUploaded }: { onUploaded: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const uploadableItems = items.filter((item) => item.status === "queued" || item.status === "failed");
  const completedItems = items.filter((item) => item.status === "done");
  const processingItems = items.filter((item) => item.status === "processing");
  const uploadSummary = items.length
    ? `${uploadableItems.length} pending${processingItems.length ? `, ${processingItems.length} processing` : ""}${completedItems.length ? `, ${completedItems.length} complete` : ""}`
    : "Drop images here when they are ready for analysis.";

  const addFiles = useCallback((files: FileList | File[]) => {
    const nextItems = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued" as const
      }));

    if (!nextItems.length) {
      setError("Drop image files only.");
      return;
    }

    setError("");
    setItems((current) => [...current, ...nextItems]);
  }, []);

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = uploading ? "none" : "copy";
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);

    if (!uploading) {
      addFiles(event.dataTransfer.files);
    }
  }

  async function upload() {
    if (!uploadableItems.length || uploading) {
      return;
    }

    const uploadableIds = new Set(uploadableItems.map((item) => item.id));
    setUploading(true);
    setError("");
    setItems((current) => current.map((item) => (uploadableIds.has(item.id) ? { ...item, status: "signing" } : item)));

    try {
      const signResponse = await fetch("/api/upload/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          files: uploadableItems.map((item) => ({
            clientUploadId: item.id,
            fileName: item.file.name,
            mimeType: item.file.type || "application/octet-stream",
            size: item.file.size
          }))
        })
      });
      const signPayload = await readJsonResponse<{ uploads?: SignedUploadIntent[]; error?: string }>(signResponse);

      if (!signResponse.ok) {
        throw new Error(signPayload.error || "Could not prepare uploads.");
      }

      const intents = (signPayload.uploads || []) as SignedUploadIntent[];
      const uploadedIntents: SignedUploadIntent[] = [];
      const failedUploads: Array<{ id: string; error: string }> = [];

      await runWithConcurrency(intents, 4, async (intent) => {
        const item = uploadableItems.find((candidate) => candidate.id === intent.clientUploadId);

        if (!item) {
          return;
        }

        try {
          setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, status: "uploading" } : currentItem)));
          await uploadFileToSignedUrl(intent.signedUrl, item.file);
          uploadedIntents.push(intent);
          setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, status: "uploaded" } : currentItem)));
        } catch (directUploadError) {
          const message = directUploadError instanceof Error ? directUploadError.message : "Upload failed.";
          failedUploads.push({ id: intent.id, error: message });
          setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, status: "failed" } : currentItem)));
          setError(`${item.file.name}: ${message}`);
        }
      });

      if (!uploadedIntents.length && !failedUploads.length) {
        throw new Error("Upload failed.");
      }

      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uploads: uploadedIntents.map((intent) => ({
            clientUploadId: intent.clientUploadId,
            id: intent.id,
            storagePath: intent.storagePath,
            fileName: intent.fileName,
            mimeType: intent.mimeType
          })),
          failed: failedUploads
        })
      });
      const completePayload = await readJsonResponse<{ characters?: CharacterRecord[]; error?: string }>(completeResponse);

      if (!completeResponse.ok) {
        throw new Error(completePayload.error || "Could not finalize uploads.");
      }

      const uploadedIds = new Set(uploadedIntents.map((intent) => intent.clientUploadId));

      setItems((current) =>
        current.map((item) => {
          if (uploadedIds.has(item.id)) {
            return { ...item, status: "processing" };
          }

          return item;
        })
      );

      if (failedUploads.length) {
        setError(`${failedUploads.length} image${failedUploads.length === 1 ? "" : "s"} failed to upload. The rest are processing.`);
      } else {
        setError("");
      }

      fetch("/api/process-pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ limit: 2 })
      }).catch(() => {
        // Cron will pick up processing rows if manual kick-off is not allowed.
      });

      await onUploaded();
    } catch (uploadError) {
      setItems((current) =>
        current.map((item) => {
          if (!uploadableIds.has(item.id) || item.status === "processing" || item.status === "done") {
            return item;
          }

          return { ...item, status: "failed" };
        })
      );
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase leading-none text-muted-foreground">Batch Intake</p>
          <CardTitle className="text-lg">Upload character references</CardTitle>
          <CardDescription>{uploadSummary}</CardDescription>
        </div>

        <CardAction>
          <div className="flex items-center gap-2">
            {completedItems.length ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setItems((current) => {
                    current.filter((item) => item.status === "done").forEach((item) => URL.revokeObjectURL(item.previewUrl));
                    return current.filter((item) => item.status !== "done");
                  });
                }}
              >
                Clear completed
              </Button>
            ) : null}
            <Button type="button" onClick={upload} disabled={!uploadableItems.length || uploading}>
              {uploading ? <Loader2 className="spin" /> : <UploadCloud />}
              Upload
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-4">
        <Button
          asChild
          variant="ghost"
          className={cn(
            "h-auto min-h-[168px] w-full cursor-pointer border border-dashed border-input bg-muted text-sm font-semibold text-muted-foreground",
            "hover:border-primary hover:bg-accent hover:text-accent-foreground",
            dragActive && "border-primary bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_rgba(15,118,110,0.18),0_0_0_3px_rgba(15,118,110,0.08)]",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          <label
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={(event) => {
              if (uploading) {
                event.preventDefault();
              }
            }}
            onKeyDown={(event) => {
              if (!uploading && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-disabled={uploading}
          >
            <ImagePlus className="size-5" />
            <span>{dragActive ? "Release to add images" : "Drop images or choose files"}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              hidden
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(event.target.files);
                  event.target.value = "";
                }
              }}
            />
          </label>
        </Button>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {items.length ? (
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader className="max-sm:hidden">
                <TableRow>
                  <TableHead className="w-[52px]" />
                  <TableHead>File</TableHead>
                  <TableHead className="w-[118px]">Status</TableHead>
                  <TableHead className="w-9" />
                </TableRow>
              </TableHeader>
              <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="max-sm:grid max-sm:grid-cols-[52px_minmax(0,1fr)_36px] max-sm:items-center">
                  <TableCell className="w-[52px]">
                    <img className="size-[52px] rounded-md object-cover" src={item.previewUrl} alt="" />
                  </TableCell>
                  <TableCell className="min-w-0">
                    <div className="grid min-w-0 gap-1">
                      <strong className="block truncate text-sm font-semibold leading-tight">{item.file.name}</strong>
                      <span className="block text-xs leading-none text-muted-foreground">{formatBytes(item.file.size)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="w-[118px] max-sm:col-start-2 max-sm:col-end-4 max-sm:w-auto">
                    <div className="grid gap-1.5">
                    <StatusPill status={item.status} />
                    <span className="h-1 overflow-hidden rounded-full bg-border">
                      <span className={cn("block h-full rounded-full", progressTone(item.status))} style={{ width: progressWidth(item.status) }} />
                    </span>
                    </div>
                  </TableCell>
                  <TableCell className="w-9">
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label="Remove image"
                    onClick={() => {
                      URL.revokeObjectURL(item.previewUrl);
                      setItems((current) => current.filter((row) => row.id !== item.id));
                    }}
                  >
                    <X />
                  </Button>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
          </Card>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CharacterGrid({
  characters,
  selectedId,
  onSelect,
  loading
}: {
  characters: CharacterRecord[];
  selectedId?: string;
  onSelect: (character: CharacterRecord) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="grid min-h-[220px] gap-3 p-4">
        <Skeleton className="h-5 w-44" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-3">
          <Skeleton className="aspect-[4/5] rounded-lg" />
          <Skeleton className="aspect-[4/5] rounded-lg" />
          <Skeleton className="aspect-[4/5] rounded-lg" />
        </div>
      </Card>
    );
  }

  if (!characters.length) {
    return <Card className="grid min-h-[220px] place-items-center text-sm font-semibold text-muted-foreground">No matching characters.</Card>;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-3 max-sm:grid-cols-1">
      {characters.map((character) => {
        const profile = safeProfile(character.profile);
        const isReady = character.status === "ready";

        return (
          <Button
            variant="ghost"
            className={cn(
              "h-auto flex-col items-stretch justify-start gap-0 overflow-hidden rounded-lg border bg-card p-0 text-left shadow-xs transition-colors hover:bg-muted",
              selectedId === character.id && "border-primary ring-2 ring-primary/20"
            )}
            key={character.id}
            type="button"
            onClick={() => onSelect({ ...character, profile })}
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
              <img className="size-full object-cover" src={character.image_url} alt={profile.summary || character.file_name} />
              {!isReady ? (
                <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-[2px]">
                  <Badge variant="outline" className={cn("gap-1.5", statusTone(character.status))}>
                    {character.status === "processing" ? <Loader2 className="spin size-3" /> : null}
                    {libraryStatusLabel(character)}
                  </Badge>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 p-2.5">
              <div className="grid gap-0.5">
                <div className="flex items-start justify-between gap-2">
                  <strong className="line-clamp-2 text-sm font-semibold leading-snug">{profile.summary}</strong>
                  {typeof character.similarity === "number" ? <span className="shrink-0 text-xs font-semibold text-primary">{Math.round(character.similarity * 100)}%</span> : null}
                </div>
                <span className="truncate text-xs text-muted-foreground">{profile.shot_type}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profileChips(profile).map((chip) => (
                  <Badge variant="outline" className="max-w-full overflow-hidden text-ellipsis text-muted-foreground" key={chip}>
                    {chip}
                  </Badge>
                ))}
              </div>
            </div>
          </Button>
        );
      })}
    </div>
  );
}

function CharacterDrawer({ character, onDeleted }: { character: CharacterRecord | null; onDeleted: (id: string) => void }) {
  const profile = character ? safeProfile(character.profile) : null;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [downloading, setDownloading] = useState(false);
  const [deleteState, setDeleteState] = useState<"idle" | "confirming" | "deleting">("idle");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setCopyState("idle");
    setDeleteState("idle");
    setDeleteError("");
  }, [character?.id]);

  if (!character || !profile) {
    return (
      <Card className="sticky top-[92px] grid min-h-[calc(100vh-120px)] place-items-center text-sm font-semibold text-muted-foreground max-xl:static max-xl:min-h-40">
        <div className="grid place-items-center gap-2">
          <ImagePlus className="size-6" />
          <span>Select a character.</span>
        </div>
      </Card>
    );
  }

  async function copyImageUrl() {
    if (!character?.image_url) {
      return;
    }

    try {
      await copyText(character.image_url);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  async function downloadReference() {
    if (!character?.image_url || downloading) {
      return;
    }

    setDownloading(true);

    try {
      const response = await fetch(`/api/download?id=${encodeURIComponent(character.id)}`);

      if (!response.ok) {
        throw new Error("Download failed.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = character.file_name || "character-reference";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  async function deleteReference() {
    if (!character || deleteState === "deleting") {
      return;
    }

    if (deleteState !== "confirming") {
      setDeleteState("confirming");
      setDeleteError("");
      return;
    }

    setDeleteState("deleting");
    setDeleteError("");

    try {
      const response = await fetch("/api/characters", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: character.id })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Delete failed.");
      }

      onDeleted(character.id);
    } catch (error) {
      setDeleteState("confirming");
      setDeleteError(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <Card className="sticky top-[92px] overflow-hidden max-xl:static">
      <div className="relative aspect-[4/4.7] bg-secondary">
        <img className="size-full object-cover" src={character.image_url} alt={profile.summary} />
      </div>

      <CardHeader>
        {character.status !== "ready" ? (
          <Badge variant="outline" className={cn("mb-2 w-fit gap-1.5", statusTone(character.status))}>
            {character.status === "processing" ? <Loader2 className="spin size-3" /> : null}
            {libraryStatusLabel(character)}
          </Badge>
        ) : null}
        <CardTitle className="text-[17px] leading-snug">{profile.summary}</CardTitle>
        <CardDescription className="break-words">{character.file_name}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" onClick={downloadReference} disabled={downloading}>
            {downloading ? <Loader2 className="spin" /> : <Download />}
            {downloading ? "Downloading" : "Download reference"}
          </Button>
          <Button variant="outline" type="button" onClick={copyImageUrl}>
            {copyState === "copied" ? <Check /> : <Copy />}
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy reference"}
          </Button>
          <Button
            variant={deleteState === "confirming" || deleteState === "deleting" ? "destructive" : "outline"}
            type="button"
            onClick={deleteReference}
            disabled={deleteState === "deleting"}
          >
            {deleteState === "deleting" ? <Loader2 className="spin" /> : <Trash2 />}
            {deleteState === "deleting" ? "Deleting" : deleteState === "confirming" ? "Confirm delete" : "Delete reference"}
          </Button>
        </div>

        {deleteError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{deleteError}</AlertDescription>
          </Alert>
        ) : null}

        <Table>
          <TableBody>
            <Attribute label="Age range" value={profile.apparent_age_range} />
            <Attribute label="Presentation" value={profile.gender_presentation} />
            <Attribute label="Wardrobe" value={profile.wardrobe.join(", ") || "unknown"} />
            <Attribute label="Colors" value={profile.dominant_colors.join(", ") || "unknown"} />
            <Attribute label="Expression" value={profile.expression} />
            <Attribute label="Pose" value={profile.pose} />
            <Attribute label="Shot" value={profile.shot_type} />
            <Attribute label="Background" value={profile.background} />
            <Attribute label="Style" value={profile.style} />
            <Attribute label="Quality" value={profile.quality_notes} />
          </TableBody>
        </Table>

        <div>
          <p className="mb-2 text-xs font-bold text-muted-foreground">Search phrases</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.searchable_phrases.map((phrase) => (
              <Badge variant="outline" className="max-w-full overflow-hidden text-ellipsis text-muted-foreground" key={phrase}>
                {phrase}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Attribute({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="w-28 align-top text-xs font-semibold text-muted-foreground">{label}</TableCell>
      <TableCell className="break-words whitespace-normal align-top text-sm leading-snug">{value}</TableCell>
    </TableRow>
  );
}

function StatusPill({ status }: { status: UploadItem["status"] }) {
  return (
    <Badge variant="outline" className={cn("justify-center capitalize", statusTone(status))}>
      {status === "uploaded" ? "Uploaded" : status}
    </Badge>
  );
}

function profileChips(profile: CharacterProfile) {
  return [
    profile.apparent_age_range,
    profile.gender_presentation,
    profile.wardrobe[0],
    profile.dominant_colors[0]
  ].filter(Boolean);
}

function safeProfile(profile: Partial<CharacterProfile> | null | undefined): CharacterProfile {
  return {
    summary: profile?.summary || "AI character reference image.",
    apparent_age_range: profile?.apparent_age_range || "unknown",
    gender_presentation: profile?.gender_presentation || "unknown",
    wardrobe: Array.isArray(profile?.wardrobe) ? profile.wardrobe : [],
    dominant_colors: Array.isArray(profile?.dominant_colors) ? profile.dominant_colors : [],
    expression: profile?.expression || "unknown",
    pose: profile?.pose || "unknown",
    shot_type: profile?.shot_type || "unknown",
    background: profile?.background || "unknown",
    style: profile?.style || "realistic AI character reference",
    quality_notes: profile?.quality_notes || "No quality notes generated.",
    searchable_phrases: Array.isArray(profile?.searchable_phrases) ? profile.searchable_phrases : []
  };
}

function statusTone(status: UploadItem["status"] | CharacterRecord["status"]) {
  if (status === "done" || status === "ready") {
    return "border-success/20 bg-success/10 text-success";
  }

  if (status === "failed") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  return "border-warning/20 bg-warning/10 text-warning";
}

function progressTone(status: UploadItem["status"]) {
  if (status === "done") {
    return "bg-success";
  }

  if (status === "failed") {
    return "bg-destructive";
  }

  if (status === "uploading" || status === "uploaded" || status === "processing") {
    return "bg-info";
  }

  return "bg-warning";
}

function progressWidth(status: UploadItem["status"]) {
  if (status === "done" || status === "failed") {
    return "100%";
  }

  if (status === "uploading") {
    return "62%";
  }

  if (status === "processing") {
    return "82%";
  }

  if (status === "uploaded") {
    return "72%";
  }

  if (status === "signing") {
    return "36%";
  }

  return "20%";
}

function libraryStatusLabel(character: CharacterRecord) {
  if (character.status === "queued") {
    return "Queued";
  }

  if (character.status === "processing" && character.error_message) {
    return "Retrying";
  }

  if (character.status === "processing") {
    return "Processing";
  }

  if (character.status === "failed") {
    return "Failed";
  }

  return "Ready";
}

function hasDraggedFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes("Files");
}

async function uploadFileToSignedUrl(signedUrl: string, file: File) {
  const formData = new FormData();

  formData.append("cacheControl", "3600");
  formData.append("", file);

  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "x-upsert": "false"
    },
    body: formData
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Storage upload failed.");
  }
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const message = cleanServerText(text);
    throw new Error(message || `Server returned ${response.status} instead of JSON.`);
  }
}

function cleanServerText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const promise = worker(item).finally(() => executing.delete(promise));
    executing.add(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}
