import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { 
  FloppyDisk, 
  CircleNotch,
  Eye,
  EyeSlash,
  Key,
  Globe
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [show2Captcha, setShow2Captcha] = useState(false);
  const [showNopecha, setShowNopecha] = useState(false);

  const [formData, setFormData] = useState({
    proxyList: "",
    captcha2captchaKey: "",
    captchaNopechaKey: ""
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      setFormData({
        proxyList: res.data.proxy_list || "",
        captcha2captchaKey: res.data.captcha_2captcha_key || "",
        captchaNopechaKey: res.data.captcha_nopecha_key || ""
      });
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await axios.put(`${API}/settings`, {
        proxy_list: formData.proxyList,
        captcha_2captcha_key: formData.captcha2captchaKey,
        captcha_nopecha_key: formData.captchaNopechaKey
      });
      toast.success("Settings saved");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const proxyCount = formData.proxyList
    .split("\n")
    .filter(line => line.trim()).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="settings-loading">
        <CircleNotch size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="settings-page">
      <h1 className="text-2xl font-bold">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Proxy List */}
        <div className="border border-border">
          <div className="p-4 border-b border-border bg-secondary flex items-center gap-2">
            <Globe size={18} />
            <span className="font-semibold">Proxy Configuration</span>
          </div>
          <div className="p-4">
            <Label htmlFor="proxy-list" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
              Proxy List ({proxyCount} proxies)
            </Label>
            <Textarea
              id="proxy-list"
              value={formData.proxyList}
              onChange={(e) => setFormData(prev => ({ ...prev, proxyList: e.target.value }))}
              placeholder="ip:port:username:password&#10;ip:port:username:password&#10;..."
              rows={8}
              className="font-mono text-sm"
              data-testid="proxy-list-input"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Format: <code className="bg-secondary px-1">ip:port:username:password</code> — one per line.
              Username and password are optional.
            </p>
          </div>
        </div>

        {/* Captcha API Keys */}
        <div className="border border-border">
          <div className="p-4 border-b border-border bg-secondary flex items-center gap-2">
            <Key size={18} />
            <span className="font-semibold">Captcha Solver API Keys</span>
          </div>
          <div className="p-4 space-y-4">
            {/* 2Captcha */}
            <div>
              <Label htmlFor="2captcha-key" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                2Captcha API Key
              </Label>
              <div className="relative">
                <Input
                  id="2captcha-key"
                  type={show2Captcha ? "text" : "password"}
                  value={formData.captcha2captchaKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, captcha2captchaKey: e.target.value }))}
                  placeholder="Enter your 2Captcha API key"
                  className="pr-10 font-mono"
                  data-testid="2captcha-key-input"
                />
                <button
                  type="button"
                  onClick={() => setShow2Captcha(!show2Captcha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="toggle-2captcha-visibility"
                >
                  {show2Captcha ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get your API key at{" "}
                <a 
                  href="https://2captcha.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  2captcha.com
                </a>
              </p>
            </div>

            {/* NopeCHA */}
            <div>
              <Label htmlFor="nopecha-key" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                NopeCHA API Key
              </Label>
              <div className="relative">
                <Input
                  id="nopecha-key"
                  type={showNopecha ? "text" : "password"}
                  value={formData.captchaNopechaKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, captchaNopechaKey: e.target.value }))}
                  placeholder="Enter your NopeCHA API key"
                  className="pr-10 font-mono"
                  data-testid="nopecha-key-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNopecha(!showNopecha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="toggle-nopecha-visibility"
                >
                  {showNopecha ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get your API key at{" "}
                <a 
                  href="https://nopecha.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  nopecha.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="border border-border p-4 bg-secondary/50">
          <h3 className="font-semibold mb-2">How it works</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Proxies:</strong> Rotated sequentially for each browser context</li>
            <li>• <strong>Captcha Solvers:</strong> Used as fallback when stealth mode fails</li>
            <li>• <strong>Stealth Mode:</strong> Always enabled (playwright-stealth + human-like behavior)</li>
          </ul>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={saving}
            className="bg-primary text-white hover:bg-blue-800"
            data-testid="save-settings-btn"
          >
            {saving ? (
              <CircleNotch size={16} className="animate-spin mr-2" />
            ) : (
              <FloppyDisk size={16} className="mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
