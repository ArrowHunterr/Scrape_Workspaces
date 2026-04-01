import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  Warning, 
  CircleNotch,
  Clock,
  Trash,
  Database,
  FileText,
  Rows
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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

const statusConfig = {
  success: { icon: CheckCircle, class: "status-success", label: "Success" },
  failed: { icon: XCircle, class: "status-failed", label: "Failed" },
  partial: { icon: Warning, class: "status-partial", label: "Partial" },
  running: { icon: CircleNotch, class: "status-running", label: "Running" },
  pending: { icon: Clock, class: "status-pending", label: "Pending" },
};

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteJobId, setDeleteJobId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, statsRes] = await Promise.all([
        axios.get(`${API}/jobs`),
        axios.get(`${API}/stats`)
      ]);
      setJobs(jobsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteJobId) return;
    try {
      await axios.delete(`${API}/jobs/${deleteJobId}`);
      toast.success("Job deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete job");
    } finally {
      setDeleteJobId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
        <CircleNotch size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border">
          <StatCard 
            label="TOTAL JOBS" 
            value={stats.total_jobs} 
            icon={Database}
          />
          <StatCard 
            label="SUCCESS RATE" 
            value={stats.total_jobs > 0 
              ? `${Math.round((stats.success_jobs / stats.total_jobs) * 100)}%` 
              : "0%"
            } 
            icon={CheckCircle}
          />
          <StatCard 
            label="ITEMS EXTRACTED" 
            value={stats.total_items_extracted.toLocaleString()} 
            icon={Rows}
          />
          <StatCard 
            label="TEMPLATES" 
            value={stats.total_templates} 
            icon={FileText}
          />
        </div>
      )}

      {/* Jobs Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Job History</h2>
        <Link to="/new-job">
          <Button data-testid="create-job-btn" className="bg-primary text-white hover:bg-blue-800">
            New Job
          </Button>
        </Link>
      </div>

      {/* Jobs Table */}
      {jobs.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <Database size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No jobs yet</p>
          <Link to="/new-job">
            <Button data-testid="create-first-job-btn">Create your first job</Button>
          </Link>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <table className="w-full dense-table" data-testid="jobs-table">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left font-semibold text-xs uppercase tracking-wider">Name</th>
                <th className="text-left font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="text-left font-semibold text-xs uppercase tracking-wider hidden md:table-cell">URLs</th>
                <th className="text-left font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">Items</th>
                <th className="text-left font-semibold text-xs uppercase tracking-wider">Created</th>
                <th className="text-right font-semibold text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const status = statusConfig[job.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                return (
                  <tr 
                    key={job.id} 
                    className="border-b border-border hover:bg-secondary/50 transition-colors"
                    data-testid={`job-row-${job.id}`}
                  >
                    <td className="font-medium">
                      <Link 
                        to={`/jobs/${job.id}`}
                        className="hover:text-primary transition-colors"
                        data-testid={`job-link-${job.id}`}
                      >
                        {job.name}
                      </Link>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${status.class}`}>
                        <StatusIcon 
                          size={14} 
                          weight="bold" 
                          className={job.status === "running" ? "animate-spin" : ""}
                        />
                        {status.label}
                      </span>
                    </td>
                    <td className="hidden md:table-cell font-mono text-sm text-muted-foreground">
                      {job.urls?.length || 0}
                    </td>
                    <td className="hidden lg:table-cell font-mono text-sm">
                      {job.items_extracted || 0}
                    </td>
                    <td className="text-muted-foreground text-sm">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/jobs/${job.id}`}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`view-job-${job.id}`}
                          >
                            <ArrowRight size={16} />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setDeleteJobId(job.id)}
                          data-testid={`delete-job-${job.id}`}
                          className="text-destructive hover:text-destructive hover:bg-red-50"
                        >
                          <Trash size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the job and its output files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              data-testid="confirm-delete"
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

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-white p-4" data-testid={`stat-${label.toLowerCase().replace(' ', '-')}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
