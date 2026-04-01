import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Warning, 
  CircleNotch,
  Clock,
  Download,
  Terminal,
  Eye,
  EyeSlash,
  Copy,
  ArrowClockwise
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  success: { icon: CheckCircle, class: "status-success", label: "Success" },
  failed: { icon: XCircle, class: "status-failed", label: "Failed" },
  partial: { icon: Warning, class: "status-partial", label: "Partial" },
  running: { icon: CircleNotch, class: "status-running", label: "Running" },
  pending: { icon: Clock, class: "status-pending", label: "Pending" },
};

export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState(null);
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logsVisible, setLogsVisible] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/jobs/${jobId}`);
      setJob(res.data);
    } catch (error) {
      console.error("Failed to fetch job:", error);
      toast.error("Job not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [jobId, navigate]);

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API}/jobs/${jobId}/logs`);
      setLogs(res.data);
      setLogsVisible(true);
    } catch (error) {
      setLogs("No logs available.");
    }
  };

  const fetchOutput = async () => {
    try {
      const res = await axios.get(`${API}/jobs/${jobId}/output`);
      setOutput(res.data);
    } catch (error) {
      setOutput(null);
    }
  };

  useEffect(() => {
    fetchJob();
    fetchOutput();
    
    // Poll for updates if job is running
    const interval = setInterval(() => {
      if (job?.status === "running" || job?.status === "pending") {
        fetchJob();
        fetchOutput();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [fetchJob, job?.status]);

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job?.name || "output"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started");
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const formatLogs = (logText) => {
    if (!logText) return "";
    return logText.split("\n").map((line, i) => {
      let className = "log-info";
      if (line.includes("[ERROR]")) className = "log-error";
      else if (line.includes("[WARN]")) className = "log-warn";
      return (
        <div key={i} className={className}>
          {line}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="job-detail-loading">
        <CircleNotch size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) return null;

  const status = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6" data-testid="job-detail">
      {/* Back Link */}
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        data-testid="back-to-jobs"
      >
        <ArrowLeft size={16} />
        <span className="text-sm">Back to Jobs</span>
      </Link>

      {/* Job Header */}
      <div className="border border-border">
        <div className="p-4 border-b border-border bg-secondary">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid="job-name">{job.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                ID: <span className="font-mono">{job.id}</span>
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${status.class}`}>
              <StatusIcon 
                size={16} 
                weight="bold" 
                className={job.status === "running" ? "animate-spin" : ""}
              />
              {status.label}
            </span>
          </div>
        </div>

        {/* Job Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          <MetaItem label="Created" value={formatDate(job.created_at)} />
          <MetaItem label="Completed" value={formatDate(job.completed_at)} />
          <MetaItem label="URLs" value={job.urls?.length || 0} mono />
          <MetaItem label="Items Extracted" value={job.items_extracted || 0} mono />
        </div>

        {/* Selectors */}
        <div className="p-4 border-t border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Selectors
          </h3>
          <div className="flex flex-wrap gap-2">
            {job.selectors?.map((sel, i) => (
              <span 
                key={i} 
                className="inline-flex items-center gap-2 px-2 py-1 bg-secondary border border-border text-sm"
              >
                <span className="font-medium">{sel.name}:</span>
                <code className="font-mono text-xs text-muted-foreground">{sel.selector}</code>
              </span>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {job.error && (
          <div className="p-4 border-t border-border bg-red-50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-destructive mb-2">
              Error
            </h3>
            <p className="font-mono text-sm text-destructive">{job.error}</p>
          </div>
        )}
      </div>

      {/* Tabs for Output and Logs */}
      <Tabs defaultValue="output" className="border border-border">
        <TabsList className="border-b border-border bg-secondary w-full justify-start rounded-none p-0 h-auto">
          <TabsTrigger 
            value="output" 
            className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary px-6 py-3"
            data-testid="tab-output"
          >
            <Eye size={16} className="mr-2" />
            Output Preview
          </TabsTrigger>
          <TabsTrigger 
            value="logs" 
            className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary px-6 py-3"
            onClick={fetchLogs}
            data-testid="tab-logs"
          >
            <Terminal size={16} className="mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Output Tab */}
        <TabsContent value="output" className="m-0">
          <div className="p-4 border-b border-border bg-white flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {output ? `${output.split("\n").filter(l => l.trim()).length} lines` : "No output yet"}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopy}
                disabled={!output}
                data-testid="copy-output"
              >
                <Copy size={16} className="mr-1" />
                Copy
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
                disabled={!output}
                data-testid="download-output"
              >
                <Download size={16} className="mr-1" />
                Download
              </Button>
            </div>
          </div>
          <div className="terminal-viewer min-h-[300px] max-h-[500px] overflow-auto" data-testid="output-viewer">
            {output ? (
              output.split("\n").map((line, i) => (
                <div key={i}>{line || " "}</div>
              ))
            ) : (
              <span className="text-muted-foreground">
                {job.status === "running" || job.status === "pending" 
                  ? "Job is running, output will appear here..."
                  : "No output available"
                }
              </span>
            )}
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="m-0">
          <div className="p-4 border-b border-border bg-white flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Execution logs
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchLogs}
              data-testid="refresh-logs"
            >
              <ArrowClockwise size={16} className="mr-1" />
              Refresh
            </Button>
          </div>
          <div className="terminal-viewer min-h-[300px] max-h-[500px] overflow-auto" data-testid="logs-viewer">
            {logs ? formatLogs(logs) : (
              <span className="text-muted-foreground">Click "Logs" tab to load logs...</span>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* URLs List */}
      <div className="border border-border">
        <div className="p-4 border-b border-border bg-secondary">
          <h3 className="font-semibold">Target URLs</h3>
        </div>
        <div className="divide-y divide-border">
          {job.urls?.map((url, i) => (
            <div key={i} className="p-3 hover:bg-secondary/50 transition-colors">
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-mono text-sm text-primary hover:underline break-all"
              >
                {url}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value, mono = false }) {
  return (
    <div className="bg-white p-3">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
