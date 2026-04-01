import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Plus, 
  Trash, 
  Play,
  CircleNotch,
  FileCode
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NewJob() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    urls: [""],
    selectors: [{ name: "", selector: "", attribute: "" }],
    useProxy: false,
    captchaSolver: "",
    paginationEnabled: false,
    nextSelector: "",
    maxPages: 5,
    templateId: ""
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/templates`);
      setTemplates(res.data);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    }
  };

  const handleTemplateSelect = (templateId) => {
    if (templateId === "none") {
      setFormData(prev => ({ ...prev, templateId: "" }));
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        templateId: template.id,
        selectors: template.selectors.map(s => ({
          name: s.name,
          selector: s.selector,
          attribute: s.attribute || ""
        })),
        paginationEnabled: template.pagination?.enabled || false,
        nextSelector: template.pagination?.next_selector || "",
        maxPages: template.pagination?.max_pages || 5,
        captchaSolver: template.default_captcha_solver || ""
      }));
      toast.success(`Template "${template.name}" loaded`);
    }
  };

  const addUrl = () => {
    setFormData(prev => ({
      ...prev,
      urls: [...prev.urls, ""]
    }));
  };

  const removeUrl = (index) => {
    setFormData(prev => ({
      ...prev,
      urls: prev.urls.filter((_, i) => i !== index)
    }));
  };

  const updateUrl = (index, value) => {
    setFormData(prev => ({
      ...prev,
      urls: prev.urls.map((url, i) => i === index ? value : url)
    }));
  };

  const addSelector = () => {
    setFormData(prev => ({
      ...prev,
      selectors: [...prev.selectors, { name: "", selector: "", attribute: "" }]
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
    
    // Validation
    if (!formData.name.trim()) {
      toast.error("Job name is required");
      return;
    }
    
    const validUrls = formData.urls.filter(u => u.trim());
    if (validUrls.length === 0) {
      toast.error("At least one URL is required");
      return;
    }
    
    const validSelectors = formData.selectors.filter(s => s.name.trim() && s.selector.trim());
    if (validSelectors.length === 0) {
      toast.error("At least one selector is required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        urls: validUrls,
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
        use_proxy: formData.useProxy,
        captcha_solver: formData.captchaSolver || null,
        template_id: formData.templateId || null
      };

      const res = await axios.post(`${API}/jobs`, payload);
      toast.success("Job created and started");
      navigate(`/jobs/${res.data.id}`);
    } catch (error) {
      console.error("Failed to create job:", error);
      toast.error("Failed to create job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto" data-testid="new-job-page">
      <h1 className="text-2xl font-bold mb-6">Create New Job</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selection */}
        {templates.length > 0 && (
          <div className="border border-border p-4 bg-secondary/50">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
              Load from Template
            </Label>
            <Select onValueChange={handleTemplateSelect} value={formData.templateId || "none"}>
              <SelectTrigger data-testid="template-select">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <FileCode size={14} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Job Name */}
        <div className="border border-border p-4">
          <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Job Name *
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Scrape Product Prices"
            data-testid="job-name-input"
          />
        </div>

        {/* URLs */}
        <div className="border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Target URLs *
            </Label>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addUrl}
              data-testid="add-url-btn"
            >
              <Plus size={14} className="mr-1" />
              Add URL
            </Button>
          </div>
          <div className="space-y-2">
            {formData.urls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => updateUrl(i, e.target.value)}
                  placeholder="https://example.com/page"
                  className="font-mono text-sm"
                  data-testid={`url-input-${i}`}
                />
                {formData.urls.length > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeUrl(i)}
                    className="text-destructive hover:text-destructive hover:bg-red-50"
                    data-testid={`remove-url-${i}`}
                  >
                    <Trash size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Selectors */}
        <div className="border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              CSS Selectors *
            </Label>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addSelector}
              data-testid="add-selector-btn"
            >
              <Plus size={14} className="mr-1" />
              Add Selector
            </Button>
          </div>
          <div className="space-y-3">
            {formData.selectors.map((sel, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-3">
                  <Input
                    value={sel.name}
                    onChange={(e) => updateSelector(i, "name", e.target.value)}
                    placeholder="Field name"
                    data-testid={`selector-name-${i}`}
                  />
                </div>
                <div className="col-span-5">
                  <Input
                    value={sel.selector}
                    onChange={(e) => updateSelector(i, "selector", e.target.value)}
                    placeholder="CSS selector, e.g., .product-title"
                    className="font-mono text-sm"
                    data-testid={`selector-css-${i}`}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    value={sel.attribute}
                    onChange={(e) => updateSelector(i, "attribute", e.target.value)}
                    placeholder="Attribute (optional)"
                    className="font-mono text-sm"
                    data-testid={`selector-attr-${i}`}
                  />
                </div>
                <div className="col-span-1">
                  {formData.selectors.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeSelector(i)}
                      className="text-destructive hover:text-destructive hover:bg-red-50"
                      data-testid={`remove-selector-${i}`}
                    >
                      <Trash size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Leave "Attribute" empty to extract text content. Use "href", "src", etc. to extract attributes.
          </p>
        </div>

        {/* Pagination */}
        <div className="border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              id="pagination"
              checked={formData.paginationEnabled}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                paginationEnabled: checked 
              }))}
              data-testid="pagination-checkbox"
            />
            <Label htmlFor="pagination" className="text-sm font-medium cursor-pointer">
              Enable Pagination
            </Label>
          </div>
          
          {formData.paginationEnabled && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Next Button Selector</Label>
                <Input
                  value={formData.nextSelector}
                  onChange={(e) => setFormData(prev => ({ ...prev, nextSelector: e.target.value }))}
                  placeholder=".next-page, [aria-label='Next']"
                  className="font-mono text-sm"
                  data-testid="next-selector-input"
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
                  data-testid="max-pages-input"
                />
              </div>
            </div>
          )}
        </div>

        {/* Advanced Options */}
        <div className="border border-border p-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
            Advanced Options
          </Label>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="useProxy"
                checked={formData.useProxy}
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  useProxy: checked 
                }))}
                data-testid="use-proxy-checkbox"
              />
              <Label htmlFor="useProxy" className="text-sm cursor-pointer">
                Use Proxy Rotation
              </Label>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Captcha Solver</Label>
              <Select 
                value={formData.captchaSolver || "none"} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, captchaSolver: v === "none" ? "" : v }))}
              >
                <SelectTrigger data-testid="captcha-select">
                  <SelectValue placeholder="Select captcha solver..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="2captcha">2Captcha</SelectItem>
                  <SelectItem value="nopecha">NopeCHA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => navigate("/")}
            data-testid="cancel-btn"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="bg-primary text-white hover:bg-blue-800"
            data-testid="start-job-btn"
          >
            {loading ? (
              <CircleNotch size={16} className="animate-spin mr-2" />
            ) : (
              <Play size={16} className="mr-2" />
            )}
            Start Job
          </Button>
        </div>
      </form>
    </div>
  );
}
