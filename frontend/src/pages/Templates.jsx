import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { 
  Plus, 
  Trash, 
  PencilSimple,
  FileCode,
  CircleNotch,
  X
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    selectors: [{ name: "", selector: "", attribute: "" }],
    paginationEnabled: false,
    nextSelector: "",
    maxPages: 5,
    defaultCaptchaSolver: ""
  });

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/templates`);
      setTemplates(res.data);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      selectors: [{ id: crypto.randomUUID(), name: "", selector: "", attribute: "" }],
      paginationEnabled: false,
      nextSelector: "",
      maxPages: 5,
      defaultCaptchaSolver: ""
    });
    setEditingTemplate(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      selectors: template.selectors.map(s => ({
        id: crypto.randomUUID(),
        name: s.name,
        selector: s.selector,
        attribute: s.attribute || ""
      })),
      paginationEnabled: template.pagination?.enabled || false,
      nextSelector: template.pagination?.next_selector || "",
      maxPages: template.pagination?.max_pages || 5,
      defaultCaptchaSolver: template.default_captcha_solver || ""
    });
    setDialogOpen(true);
  };

  const addSelector = () => {
    setFormData(prev => ({
      ...prev,
      selectors: [...prev.selectors, { id: crypto.randomUUID(), name: "", selector: "", attribute: "" }]
    }));
  };

  const removeSelector = (index) => {
    setFormData(prev => ({
      ...prev,
      selectors: prev.selectors.filter((_, i) => i !== index)
    }));
  };

  const updateSelector = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      selectors: prev.selectors.map((sel, i) => 
        i === index ? { ...sel, [field]: value } : sel
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    
    const validSelectors = formData.selectors.filter(s => s.name.trim() && s.selector.trim());
    if (validSelectors.length === 0) {
      toast.error("At least one selector is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        selectors: validSelectors.map(s => ({
          name: s.name,
          selector: s.selector,
          attribute: s.attribute || null
        })),
        pagination: formData.paginationEnabled ? {
          enabled: true,
          next_selector: formData.nextSelector,
          max_pages: formData.maxPages
        } : null,
        default_captcha_solver: formData.defaultCaptchaSolver || null
      };

      if (editingTemplate) {
        await axios.put(`${API}/templates/${editingTemplate.id}`, payload);
        toast.success("Template updated");
      } else {
        await axios.post(`${API}/templates`, payload);
        toast.success("Template created");
      }
      
      setDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`${API}/templates/${deleteId}`);
      toast.success("Template deleted");
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to delete template");
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="templates-loading">
        <CircleNotch size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="templates-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Button 
          onClick={openCreateDialog}
          className="bg-primary text-white hover:bg-blue-800"
          data-testid="create-template-btn"
        >
          <Plus size={16} className="mr-2" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <FileCode size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No templates yet</p>
          <Button onClick={openCreateDialog} data-testid="create-first-template-btn">
            Create your first template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div 
              key={template.id}
              className="border border-border p-4 card-hover bg-white"
              data-testid={`template-card-${template.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openEditDialog(template)}
                    data-testid={`edit-template-${template.id}`}
                  >
                    <PencilSimple size={16} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setDeleteId(template.id)}
                    className="text-destructive hover:text-destructive hover:bg-red-50"
                    data-testid={`delete-template-${template.id}`}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Selectors ({template.selectors?.length || 0})
                </div>
                <div className="flex flex-wrap gap-1">
                  {template.selectors?.slice(0, 3).map((sel, i) => (
                    <span 
                      key={i}
                      className="px-2 py-0.5 bg-secondary text-xs font-mono"
                    >
                      {sel.name}
                    </span>
                  ))}
                  {template.selectors?.length > 3 && (
                    <span className="px-2 py-0.5 bg-secondary text-xs">
                      +{template.selectors.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {template.pagination?.enabled && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Pagination: up to {template.pagination.max_pages} pages
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="tpl-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                Name *
              </Label>
              <Input
                id="tpl-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., E-commerce Product Scraper"
                data-testid="template-name-input"
              />
            </div>

            <div>
              <Label htmlFor="tpl-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                Description
              </Label>
              <Textarea
                id="tpl-desc"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
                rows={2}
                data-testid="template-desc-input"
              />
            </div>

            {/* Selectors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Selectors *
                </Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addSelector}
                  data-testid="tpl-add-selector-btn"
                >
                  <Plus size={14} className="mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {formData.selectors.map((sel, i) => (
                  <div key={sel.id} className="flex gap-2 items-center">
                    <Input
                      value={sel.name}
                      onChange={(e) => updateSelector(i, "name", e.target.value)}
                      placeholder="Name"
                      className="w-1/4"
                      data-testid={`tpl-selector-name-${i}`}
                    />
                    <Input
                      value={sel.selector}
                      onChange={(e) => updateSelector(i, "selector", e.target.value)}
                      placeholder="CSS Selector"
                      className="flex-1 font-mono text-sm"
                      data-testid={`tpl-selector-css-${i}`}
                    />
                    <Input
                      value={sel.attribute}
                      onChange={(e) => updateSelector(i, "attribute", e.target.value)}
                      placeholder="Attr"
                      className="w-20 font-mono text-sm"
                      data-testid={`tpl-selector-attr-${i}`}
                    />
                    {formData.selectors.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeSelector(i)}
                        className="text-destructive"
                        data-testid={`tpl-remove-selector-${i}`}
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            <div className="border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="tpl-pagination"
                  checked={formData.paginationEnabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    paginationEnabled: checked 
                  }))}
                  data-testid="tpl-pagination-checkbox"
                />
                <Label htmlFor="tpl-pagination" className="text-sm cursor-pointer">
                  Enable Pagination
                </Label>
              </div>
              
              {formData.paginationEnabled && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Next Selector</Label>
                    <Input
                      value={formData.nextSelector}
                      onChange={(e) => setFormData(prev => ({ ...prev, nextSelector: e.target.value }))}
                      placeholder=".next-page"
                      className="font-mono text-sm"
                      data-testid="tpl-next-selector-input"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Max Pages</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.maxPages}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxPages: parseInt(e.target.value) || 5 }))}
                      data-testid="tpl-max-pages-input"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Default Captcha Solver */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                Default Captcha Solver
              </Label>
              <Select 
                value={formData.defaultCaptchaSolver || "none"} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, defaultCaptchaSolver: v === "none" ? "" : v }))}
              >
                <SelectTrigger data-testid="tpl-captcha-select">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="2captcha">2Captcha</SelectItem>
                  <SelectItem value="nopecha">NopeCHA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="tpl-cancel-btn"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saving}
                className="bg-primary text-white hover:bg-blue-800"
                data-testid="tpl-save-btn"
              >
                {saving && <CircleNotch size={16} className="animate-spin mr-2" />}
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="tpl-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              data-testid="tpl-confirm-delete"
              className="bg-destructive text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
