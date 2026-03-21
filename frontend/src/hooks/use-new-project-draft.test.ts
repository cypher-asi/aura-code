import { renderHook, act } from "@testing-library/react";
import { useNewProjectDraft } from "./use-new-project-draft";

describe("useNewProjectDraft", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns null storedDraft when no draft is saved", () => {
    const { result } = renderHook(() => useNewProjectDraft(false));
    expect(result.current.storedDraft).toBeNull();
  });

  it("saves a draft to sessionStorage when open", () => {
    const formValues = {
      workspaceMode: "imported" as const,
      name: "My Project",
      description: "desc",
      folderPath: "/path",
    };

    renderHook(() => useNewProjectDraft(true, formValues));

    const raw = sessionStorage.getItem("aura:new-project-draft");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.name).toBe("My Project");
    expect(parsed.workspaceMode).toBe("imported");
  });

  it("does not save when not open", () => {
    const formValues = {
      workspaceMode: "imported" as const,
      name: "My Project",
      description: "desc",
      folderPath: "/path",
    };

    renderHook(() => useNewProjectDraft(false, formValues));

    expect(sessionStorage.getItem("aura:new-project-draft")).toBeNull();
  });

  it("reads existing draft on initial render", () => {
    sessionStorage.setItem(
      "aura:new-project-draft",
      JSON.stringify({
        workspaceMode: "linked",
        name: "Saved",
        description: "saved desc",
        folderPath: "/saved",
      }),
    );

    const { result } = renderHook(() => useNewProjectDraft(false));

    expect(result.current.storedDraft).toEqual({
      workspaceMode: "linked",
      name: "Saved",
      description: "saved desc",
      folderPath: "/saved",
    });
  });

  it("clearDraft removes from sessionStorage", () => {
    sessionStorage.setItem(
      "aura:new-project-draft",
      JSON.stringify({ workspaceMode: "imported", name: "", description: "", folderPath: "" }),
    );

    const { result } = renderHook(() => useNewProjectDraft(false));

    act(() => {
      result.current.clearDraft();
    });

    expect(sessionStorage.getItem("aura:new-project-draft")).toBeNull();
  });

  it("handles invalid JSON in sessionStorage", () => {
    sessionStorage.setItem("aura:new-project-draft", "not-json");

    const { result } = renderHook(() => useNewProjectDraft(false));
    expect(result.current.storedDraft).toBeNull();
  });

  it("defaults workspaceMode to imported for invalid values", () => {
    sessionStorage.setItem(
      "aura:new-project-draft",
      JSON.stringify({ workspaceMode: "invalid", name: "x", description: "", folderPath: "" }),
    );

    const { result } = renderHook(() => useNewProjectDraft(false));
    expect(result.current.storedDraft!.workspaceMode).toBe("imported");
  });
});
