import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Input,
  List,
  Popconfirm,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  InfoCircleFilled,
  LineChartOutlined,
  PieChartOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  WarningFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../../types';
import {
  useAdminDashboard,
  useAdminDashboardSearch,
  type AdminActivityItem,
  type AdminDepartmentEnhanced,
  type AdminSearchResult,
  type AdminTrend,
  type AdminUser,
} from '../../api/dashboard';
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../../api/notifications';
import { useDeleteUser } from '../../api/users';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type RangePreset = 'today' | 'week' | 'month' | 'custom';

// ---------------------------------------------------------------------------
// Small utilities (UI-safe)
// ---------------------------------------------------------------------------

const brandGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const initialsFrom = (nameOrEmail: string) => {
  const cleaned = (nameOrEmail || '').trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (cleaned.includes('@')) return cleaned[0].toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
};

const timeAgo = (iso: string) => {
  const d = dayjs(iso);
  if (!d.isValid()) return iso;
  return d.fromNow();
};

const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  const escapeCell = (val: string) => {
    const v = (val ?? '').toString().replaceAll('\"', '\"\"');
    return `\"${v}\"`;
  };

  const csv = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map((c) => escapeCell(c)).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const rolePill = (role: string) => {
  const map: Record<string, { color: string; label: string }> = {
    STUDENT: { color: 'green', label: 'Student' },
    TEACHER: { color: 'purple', label: 'Teacher' },
    HOD: { color: 'orange', label: 'HOD' },
    ADMIN: { color: 'blue', label: 'Admin' },
  };
  const meta = map[role] || { color: 'default', label: role };
  return (
    <Tag color={meta.color} style={{ borderRadius: 16, paddingInline: 10 }}>
      {meta.label}
    </Tag>
  );
};

const departmentEmoji = (name?: string, code?: string) => {
  const key = `${name || ''} ${code || ''}`.toLowerCase();
  if (key.includes('cs') || key.includes('computer') || key.includes('software')) return '\u{1F4BB}'; // 💻
  if (key.includes('bba') || key.includes('business') || key.includes('management')) return '\u{1F4BC}'; // 💼
  if (key.includes('eng') || key.includes('engineering')) return '\u{1F6E0}\u{FE0F}'; // 🛠️
  if (key.includes('med') || key.includes('medical') || key.includes('nursing')) return '\u{1FA7A}'; // 🩺
  if (key.includes('arts') || key.includes('design')) return '\u{1F3A8}'; // 🎨
  return '\u{1F3EB}'; // 🏫
};

const trendMeta = (trend?: AdminTrend) => {
  const delta = trend?.delta ?? 0;
  const period = trend?.period_label ?? '';
  if (!trend) return { icon: null, text: '--', color: 'rgba(255,255,255,0.86)' };
  if (trend.direction === 'up') {
    return { icon: <ArrowUpOutlined />, text: `+${delta} ${period}`, color: '#16a34a' };
  }
  if (trend.direction === 'down') {
    return { icon: <ArrowDownOutlined />, text: `${delta} ${period}`, color: '#ef4444' };
  }
  return { icon: <ClockCircleOutlined />, text: `0 ${period}`, color: 'rgba(255,255,255,0.72)' };
};

type NotificationTone = 'success' | 'info' | 'warning' | 'error';
const notificationTone = (n: Notification): NotificationTone => {
  const level = String(n.metadata?.level || n.metadata?.type || '').toLowerCase();
  if (['success', 'ok', 'approved'].includes(level)) return 'success';
  if (['warn', 'warning', 'alert'].includes(level)) return 'warning';
  if (['error', 'critical', 'failed', 'rejected'].includes(level)) return 'error';

  const s = `${n.subject} ${n.body}`.toLowerCase();
  if (s.includes('approved') || s.includes('success')) return 'success';
  if (s.includes('warning') || s.includes('violation')) return 'warning';
  if (s.includes('rejected') || s.includes('failed') || s.includes('error')) return 'error';
  return 'info';
};

const notificationToneMeta = (tone: NotificationTone) => {
  switch (tone) {
    case 'success':
      return { icon: <CheckCircleFilled />, color: '#16a34a', label: 'Success' };
    case 'warning':
      return { icon: <WarningFilled />, color: '#f59e0b', label: 'Warning' };
    case 'error':
      return { icon: <ExclamationCircleFilled />, color: '#ef4444', label: 'Critical' };
    default:
      return { icon: <InfoCircleFilled />, color: '#3b82f6', label: 'Info' };
  }
};

// ---------------------------------------------------------------------------
// Reusable sub-components (dashboard-scoped)
// ---------------------------------------------------------------------------

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}> = ({ icon, title, subtitle, extra }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'rgba(102, 126, 234, 0.14)',
          display: 'grid',
          placeItems: 'center',
          color: '#4f46e5',
          flex: '0 0 auto',
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        {subtitle ? (
          <Text type="secondary" style={{ display: 'block' }}>
            {subtitle}
          </Text>
        ) : null}
      </div>
    </div>
    {extra ? <div>{extra}</div> : null}
  </div>
);

const StatCard: React.FC<{
  title: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  accent: string;
  trend?: AdminTrend;
  onClick?: () => void;
  loading?: boolean;
}> = ({ title, label, value, icon, gradient, accent, trend, onClick, loading }) => {
  const t = trendMeta(trend);

  return (
    <Card
      className="sentra-hover-lift"
      bodyStyle={{ padding: 18 }}
      style={{
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        background: gradient,
        overflow: 'hidden',
        position: 'relative',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      aria-label={onClick ? `${title} card` : undefined}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 44%), radial-gradient(circle at 85% 10%, rgba(255,255,255,0.12), transparent 42%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <Text style={{ color: 'rgba(255,255,255,0.86)', fontWeight: 600 }}>{title}</Text>
            <div style={{ marginTop: 8 }}>
              {loading ? (
                <Skeleton active paragraph={false} title={{ width: 110 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1.15 }}>
                  {value.toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              <Text style={{ color: 'rgba(255,255,255,0.74)' }}>{label}</Text>
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.16)',
              display: 'grid',
              placeItems: 'center',
              color: accent,
              boxShadow: '0 10px 18px rgba(0,0,0,0.16)',
              flex: '0 0 auto',
            }}
            aria-hidden
          >
            {icon}
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: t.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t.icon} {t.text}
          </Text>
        </div>
      </div>
    </Card>
  );
};

const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, icon, children, actions }) => (
  <Card style={{ height: '100%' }} bodyStyle={{ padding: 18 }}>
    <SectionHeader icon={icon} title={title} subtitle={subtitle} extra={actions} />
    <div style={{ marginTop: 14, height: 260 }}>{children}</div>
  </Card>
);

type MiniLinePoint = { label: string; value: number };

const MiniLineChart: React.FC<{ data: MiniLinePoint[]; stroke?: string }> = ({ data, stroke = '#667eea' }) => {
  const width = 100;
  const height = 36;
  const pad = 4;

  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const maxRaw = Math.max(...values, 1);
  const max = maxRaw === min ? min + 1 : maxRaw;

  const points = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : pad + (i / (data.length - 1)) * (width - pad * 2);
    const t = (d.value - min) / (max - min);
    const y = pad + (1 - t) * (height - pad * 2);
    return { x, y, label: d.label, value: d.value };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(2)} ${(height - pad).toFixed(2)} L ${points[0]?.x.toFixed(2)} ${(height - pad).toFixed(2)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="miniArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* grid */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={width - pad}
          y1={pad + t * (height - pad * 2)}
          y2={pad + t * (height - pad * 2)}
          stroke="var(--stroke)"
          strokeWidth="0.6"
        />
      ))}

      <path d={areaPath} fill="url(#miniArea)" />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.6" />

      {points.map((p) => (
        <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r="1.6" fill={stroke}>
          <title>
            {p.label}: {p.value}
          </title>
        </circle>
      ))}
    </svg>
  );
};

type MiniDonutSlice = { label: string; value: number; color: string };

const MiniDonutChart: React.FC<{ slices: MiniDonutSlice[]; centerLabel?: string }> = ({ slices, centerLabel }) => {
  const total = slices.reduce((acc, s) => acc + (Number.isFinite(s.value) ? s.value : 0), 0);
  const normalized = slices
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, pct: total ? (s.value / total) * 100 : 0 }));

  let offset = 0;

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', height: '100%' }}>
      <svg viewBox="0 0 42 42" width="160" height="160" style={{ flex: '0 0 auto' }} aria-label="Distribution chart">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--stroke)" strokeWidth="6" />
        {normalized.map((s) => {
          const dash = `${s.pct} ${100 - s.pct}`;
          const el = (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={s.color}
              strokeWidth="6"
              strokeDasharray={dash}
              strokeDashoffset={String(-offset)}
              transform="rotate(-90 21 21)"
            >
              <title>
                {s.label}: {s.value} ({Math.round(s.pct)}%)
              </title>
            </circle>
          );
          offset += s.pct;
          return el;
        })}
        <text x="21" y="20.5" textAnchor="middle" dominantBaseline="middle" fontSize="4.2" fill="var(--muted-ink)">
          {centerLabel || 'Total'}
        </text>
        <text x="21" y="26" textAnchor="middle" dominantBaseline="middle" fontSize="6.2" fontWeight="700" fill="var(--ink)">
          {total.toLocaleString()}
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {normalized.slice(0, 6).map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Space size={10} style={{ minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color, flex: '0 0 auto' }} aria-hidden />
                <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</Text>
              </Space>
              <Text strong>
                {Math.round(s.pct)}% ({s.value})
              </Text>
            </div>
          ))}
        </Space>
      </div>
    </div>
  );
};

type MiniBarItem = { label: string; value: number };

const MiniBarList: React.FC<{ items: MiniBarItem[] }> = ({ items }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ height: '100%', overflow: 'auto', paddingRight: 6 }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 12, alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </Text>
              <Progress
                percent={Math.round((item.value / max) * 100)}
                size="small"
                showInfo={false}
                strokeColor={brandGradient}
              />
            </div>
            <Text strong style={{ textAlign: 'right' }}>
              {item.value.toLocaleString()}
            </Text>
          </div>
        ))}
      </Space>
    </div>
  );
};

const ActivityItem: React.FC<{ item: AdminActivityItem; onClick?: () => void }> = ({ item, onClick }) => {
  const typeIcon: Record<AdminActivityItem['type'], React.ReactNode> = {
    USER: <UserOutlined />,
    COURSE: <BookOutlined />,
    ENROLLMENT: <TeamOutlined />,
    ASSESSMENT: <FileTextOutlined />,
    VIOLATION: <WarningFilled />,
  };

  return (
    <List.Item
      style={{
        borderRadius: 14,
        border: '1px solid var(--stroke)',
        marginBottom: 10,
        padding: 14,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <List.Item.Meta
        avatar={
          <Avatar style={{ background: brandGradient, fontWeight: 700 }} icon={!item.actor?.name ? <UserOutlined /> : undefined}>
            {item.actor?.name ? initialsFrom(item.actor.name) : undefined}
          </Avatar>
        }
        title={
          <Space size={10} wrap>
            <Tag color="geekblue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
              {typeIcon[item.type]} <span style={{ marginLeft: 6 }}>{item.type}</span>
            </Tag>
            <Text strong>{item.title}</Text>
            <Text type="secondary">- {timeAgo(item.created_at)}</Text>
          </Space>
        }
        description={<Text type="secondary">{item.message}</Text>}
      />
    </List.Item>
  );
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Filters
  const [rangePreset, setRangePreset] = useState<RangePreset>('week');
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>();

  // Global search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Persist last searches (simple, local-only)
  const recentSearchKey = 'sentraexam_admin_recent_searches';
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(recentSearchKey);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  // Recent registrations table filters
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'PENDING' | undefined>();

  // Detail drawers
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<AdminUser | null>(null);

  // Activity feed paging
  const [activityVisible, setActivityVisible] = useState(8);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const dashboardParams = useMemo(() => {
    if (rangePreset !== 'custom') return { range: rangePreset as Exclude<RangePreset, 'custom'> };
    const [start, end] = customRange;
    return {
      range: 'custom' as const,
      start: start?.toISOString(),
      end: end?.toISOString(),
    };
  }, [customRange, rangePreset]);

  const { data, isLoading, error, refetch } = useAdminDashboard(dashboardParams);
  const { data: unreadData } = useUnreadNotificationCount();
  const { data: notificationsData, isLoading: notificationsLoading } = useNotifications({ page: 1 });
  const markAllRead = useMarkAllNotificationsAsRead();
  const markOneRead = useMarkNotificationAsRead();
  const deleteUserMutation = useDeleteUser();

  const { data: searchData, isFetching: searchFetching } = useAdminDashboardSearch(debouncedSearch);

  const totals = data?.totals || {
    departments: data?.total_departments || 0,
    courses: 0,
    assessments: data?.total_assessments || 0,
    enrollments: 0,
    submissions: data?.total_submissions || 0,
  };

  const trends = data?.trends || {};
  const departments = (data?.departments || []) as AdminDepartmentEnhanced[];
  const departmentOptions = departments.map((d) => ({
    label: `${departmentEmoji(d.name, d.code)} ${d.name}`,
    value: d.id,
  }));

  // Chart datasets (UI-friendly)
  const userGrowthData = useMemo(() => {
    const points = data?.charts?.user_growth || [];
    const map = new Map(points.map((p) => [dayjs(p.month).format('YYYY-MM'), p.count]));
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const m = dayjs().subtract(i, 'month');
      const key = m.format('YYYY-MM');
      months.push({ month: m.toISOString(), label: m.format('MMM'), users: map.get(key) ?? 0 });
    }
    return months;
  }, [data?.charts?.user_growth]);

  const pieData = useMemo(() => {
    const raw = data?.charts?.department_distribution || [];
    if (!raw.length) return [];
    const top = raw.slice(0, 6);
    const rest = raw.slice(6).reduce((acc, r) => acc + r.count, 0);
    return rest > 0 ? [...top, { department: 'Other', count: rest }] : top;
  }, [data?.charts?.department_distribution]);

  const barData = useMemo(() => {
    return (data?.charts?.enrollments_by_department || []).slice(0, 8);
  }, [data?.charts?.enrollments_by_department]);

  const filteredRecentUsers = useMemo(() => {
    const base = (data?.recent_users || []) as AdminUser[];
    const q = userSearch.trim().toLowerCase();

    return base
      .filter((u) => (departmentFilter ? (u.department_id || null) === departmentFilter : true))
      .filter((u) => (roleFilter ? u.role === roleFilter : true))
      .filter((u) => {
        if (!statusFilter) return true;
        return statusFilter === 'ACTIVE' ? !!u.is_active : !u.is_active;
      })
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department || '').toLowerCase().includes(q) ||
          (u.role || '').toLowerCase().includes(q)
        );
      });
  }, [data?.recent_users, departmentFilter, roleFilter, statusFilter, userSearch]);

  const filteredDepartments = useMemo(() => {
    const base = departments || [];
    return base.filter((d) => (departmentFilter ? d.id === departmentFilter : true));
  }, [departmentFilter, departments]);

  const visibleNotifications = useMemo(() => {
    return (notificationsData?.results || []).slice(0, 5);
  }, [notificationsData?.results]);

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load admin dashboard"
        description="Please try refreshing the page."
        showIcon
      />
    );
  }

  const exportRecentUsers = () => {
    downloadCsv(
      `recent-registrations-${dayjs().format('YYYY-MM-DD')}.csv`,
      ['Name', 'Email', 'Role', 'Department', 'Status', 'Registered'],
      filteredRecentUsers.map((u) => [
        u.name,
        u.email,
        u.role,
        u.department || '',
        u.is_active ? 'Active' : 'Pending',
        u.created_at || '',
      ])
    );
  };

  const exportDepartments = () => {
    downloadCsv(
      `departments-${dayjs().format('YYYY-MM-DD')}.csv`,
      ['Department', 'Code', 'Students', 'Teachers', 'Active Courses', 'Avg Class Size', 'Health'],
      filteredDepartments.map((d) => [
        d.name,
        d.code,
        String(d.students_count ?? 0),
        String(d.teachers_count ?? 0),
        String(d.active_course_count ?? 0),
        String(d.avg_class_size ?? 0),
        String(d.health ?? ''),
      ])
    );
  };

  const recentUserColumns: ColumnsType<AdminUser> = [
    {
      title: 'User',
      key: 'user',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_, record) => (
        <Space size={12}>
          <Avatar style={{ background: brandGradient, fontWeight: 800 }}>
            {initialsFrom(record.name || record.email)}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <Text strong>{record.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => rolePill(role),
      sorter: (a, b) => a.role.localeCompare(b.role),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string | null) => dept || <Text type="secondary">-</Text>,
      sorter: (a, b) => (a.department || '').localeCompare(b.department || ''),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'gold'} style={{ borderRadius: 16, paddingInline: 10 }}>
          {active ? 'Active' : 'Pending'}
        </Tag>
      ),
      sorter: (a, b) => Number(a.is_active) - Number(b.is_active),
    },
    {
      title: 'Registered',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: (a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return da - db;
      },
      render: (iso: string | null) =>
        iso ? (
          <Tooltip title={new Date(iso).toLocaleString()}>
            <Text>{timeAgo(iso)}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space size={6}>
          <Button
            type="text"
            icon={<EyeOutlined />}
            aria-label="View user"
            onClick={(e) => {
              e.stopPropagation();
              setActiveUser(record);
              setUserDrawerOpen(true);
            }}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label="Edit user"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/dashboard/users/${record.id}/edit`);
            }}
          />
          <Popconfirm
            title="Delete user?"
            description="This action cannot be undone."
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
            okButtonProps={{ loading: deleteUserMutation.isPending }}
            onConfirm={async () => {
              try {
                await deleteUserMutation.mutateAsync(record.id);
                message.success('User deleted');
                refetch();
              } catch (e: any) {
                message.error(e?.response?.data?.detail || 'Failed to delete user');
              }
            }}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="Delete user"
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const departmentColumns: ColumnsType<AdminDepartmentEnhanced> = [
    {
      title: 'Department',
      key: 'department',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_, record) => (
        <Space size={10}>
          <span style={{ fontSize: 18 }}>{departmentEmoji(record.name, record.code)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <Text strong>{record.name}</Text>
            <Tag style={{ fontFamily: 'monospace', width: 'fit-content' }}>{record.code}</Tag>
          </div>
        </Space>
      ),
    },
    {
      title: 'People',
      key: 'people',
      render: (_, record) => (
        <Text>
          {(record.students_count ?? 0).toLocaleString()} students • {(record.teachers_count ?? 0).toLocaleString()} teachers
        </Text>
      ),
    },
    {
      title: 'Quick Stats',
      key: 'stats',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{(record.active_course_count ?? 0).toLocaleString()} active courses</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Avg class size: {(record.avg_class_size ?? 0).toLocaleString()}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Capacity',
      key: 'capacity',
      render: (_, record) => (
        <Progress
          percent={clamp(record.load_percent ?? 0, 0, 100)}
          size="small"
          strokeColor={brandGradient}
          showInfo={false}
        />
      ),
    },
    {
      title: 'Health',
      key: 'health',
      render: (_, record) => {
        const health = record.health || 'HEALTHY';
        const meta =
          health === 'CRITICAL'
            ? { color: 'red', label: 'Critical' }
            : health === 'NEEDS_ATTENTION'
              ? { color: 'gold', label: 'Needs Attention' }
              : { color: 'green', label: 'Healthy' };
        return (
          <Tag color={meta.color} style={{ borderRadius: 16, paddingInline: 10 }}>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Button type="link" onClick={() => navigate('/dashboard/departments')} aria-label={`View ${record.name}`}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: 6 }}>
        Administrator Dashboard
      </Title>
      <Text type="secondary">System overview, insights, and quick admin actions.</Text>

      <div style={{ height: 16 }} />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card bodyStyle={{ padding: 16 }} style={{ height: '100%' }}>
            <SectionHeader icon={<SearchOutlined />} title="Search & Filters" subtitle="Quickly find anything and filter the dashboard." />
            <Row gutter={[12, 12]} align="middle" style={{ marginTop: 14 }}>
              <Col xs={24} xl={12}>
                <AutoComplete
                  style={{ width: '100%' }}
                  options={(searchData?.results || []).map((r: AdminSearchResult) => ({
                    value: r.route,
                    label: (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{r.subtitle}</Text>
                      </div>
                    ),
                  }))}
                  value={searchTerm}
                  onChange={setSearchTerm}
                  onSelect={(value) => {
                    if (value.startsWith('/dashboard')) {
                      const nextRecent = [searchTerm.trim(), ...recentSearches].filter(Boolean);
                      const unique = Array.from(new Set(nextRecent)).slice(0, 6);
                      try {
                        localStorage.setItem(recentSearchKey, JSON.stringify(unique));
                      } catch {
                        // ignore
                      }
                      setRecentSearches(unique);
                      navigate(value);
                    }
                  }}
                >
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Search users, courses, departments, assessments..."
                    suffix={searchFetching ? <Text type="secondary" style={{ fontSize: 12 }}>Searching...</Text> : null}
                  />
                </AutoComplete>
              </Col>
              <Col xs={24} xl={12}>
                <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Select
                    value={rangePreset}
                    onChange={(v) => setRangePreset(v)}
                    style={{ minWidth: 140 }}
                    options={[
                      { label: 'Today', value: 'today' },
                      { label: 'This Week', value: 'week' },
                      { label: 'This Month', value: 'month' },
                      { label: 'Custom', value: 'custom' },
                    ]}
                  />
                  {rangePreset === 'custom' ? (
                    <RangePicker
                      value={customRange}
                      onChange={(next) => setCustomRange(next || [null, null])}
                      showTime
                      style={{ width: 260, maxWidth: '100%' }}
                    />
                  ) : null}
                  <Select
                    allowClear
                    placeholder="All Departments"
                    value={departmentFilter}
                    onChange={(v) => setDepartmentFilter(v)}
                    style={{ minWidth: 200 }}
                    options={departmentOptions}
                  />
                  <Button onClick={() => refetch()}>Refresh</Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            bodyStyle={{ padding: 16 }}
            style={{
              height: '100%',
              border: 'none',
              background: 'linear-gradient(135deg, rgba(102,126,234,0.12) 0%, rgba(118,75,162,0.10) 100%)',
            }}
          >
            <SectionHeader icon={<PlusOutlined />} title="Quick Actions" subtitle="Create and manage faster." />
            <div style={{ marginTop: 14 }}>
              <Space wrap>
                <Button type="primary" icon={<UserOutlined />} onClick={() => navigate('/dashboard/users/new')}>
                  Add New User
                </Button>
                <Button icon={<BookOutlined />} onClick={() => navigate('/dashboard/courses/new')}>
                  Create Course
                </Button>
                <Button icon={<FileTextOutlined />} onClick={() => navigate('/dashboard/assessments/new')}>
                  New Assessment
                </Button>
                <Button icon={<DownloadOutlined />} onClick={() => window.print()}>
                  Generate Report
                </Button>
                <Button icon={<BellOutlined />} onClick={() => navigate('/dashboard/notifications/new')}>
                  Send Announcement
                </Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={8}>
          <StatCard
            title="Total Users"
            label="All accounts in the system"
            value={data?.user_counts?.total || 0}
            icon={<TeamOutlined style={{ fontSize: 20 }} />}
            accent="#93c5fd"
            gradient="linear-gradient(135deg, rgba(33,150,243,0.55) 0%, rgba(102,126,234,0.9) 100%)"
            trend={trends.users}
            onClick={() => navigate('/dashboard/users')}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <StatCard
            title="Courses"
            label="Active academic offerings"
            value={totals.courses || 0}
            icon={<BookOutlined style={{ fontSize: 20 }} />}
            accent="#86efac"
            gradient="linear-gradient(135deg, rgba(34,197,94,0.55) 0%, rgba(20,184,166,0.9) 100%)"
            trend={trends.courses}
            onClick={() => navigate('/dashboard/courses')}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <StatCard
            title="Assessments"
            label="Exams, quizzes and assignments"
            value={totals.assessments || 0}
            icon={<FileTextOutlined style={{ fontSize: 20 }} />}
            accent="#e9d5ff"
            gradient="linear-gradient(135deg, rgba(118,75,162,0.75) 0%, rgba(102,126,234,0.9) 100%)"
            trend={trends.assessments}
            onClick={() => navigate('/dashboard/assessments')}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <StatCard
            title="Students"
            label="Registered student users"
            value={data?.user_counts?.students || 0}
            icon={<UserOutlined style={{ fontSize: 20 }} />}
            accent="#fed7aa"
            gradient="linear-gradient(135deg, rgba(245,158,11,0.6) 0%, rgba(251,113,133,0.75) 100%)"
            trend={trends.students}
            onClick={() => navigate('/dashboard/users?role=STUDENT')}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <StatCard
            title="Enrollments"
            label="Course registrations and requests"
            value={totals.enrollments || 0}
            icon={<TeamOutlined style={{ fontSize: 20 }} />}
            accent="#a5f3fc"
            gradient="linear-gradient(135deg, rgba(6,182,212,0.65) 0%, rgba(14,165,233,0.9) 100%)"
            trend={trends.enrollments}
            onClick={() => navigate('/dashboard/enrollments')}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <StatCard
            title="Departments"
            label="Academic units"
            value={totals.departments || 0}
            icon={<PieChartOutlined style={{ fontSize: 20 }} />}
            accent="#ddd6fe"
            gradient="linear-gradient(135deg, rgba(139,92,246,0.65) 0%, rgba(118,75,162,0.9) 100%)"
            trend={undefined}
            onClick={() => navigate('/dashboard/departments')}
            loading={isLoading}
          />
        </Col>
      </Row>

      <div style={{ height: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card bodyStyle={{ padding: 16 }}>
            <SectionHeader
              icon={<BellOutlined />}
              title="System Notifications"
              subtitle="Latest 5 notifications"
              extra={
                <Space wrap>
                  <Badge count={unreadData?.count || 0} size="small" color="#ef4444" />
                  <Button
                    onClick={async () => {
                      try {
                        await markAllRead.mutateAsync();
                        message.success('All notifications marked as read');
                      } catch {
                        message.error('Failed to mark all as read');
                      }
                    }}
                    disabled={!unreadData?.count}
                    loading={markAllRead.isPending}
                  >
                    Mark all as read
                  </Button>
                  <Button type="link" onClick={() => navigate('/dashboard/notifications')}>
                    View all
                  </Button>
                </Space>
              }
            />
            <div style={{ marginTop: 12 }}>
              {notificationsLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : visibleNotifications.length ? (
                <List
                  dataSource={visibleNotifications}
                  renderItem={(n) => {
                    const tone = notificationTone(n);
                    const meta = notificationToneMeta(tone);
                    return (
                      <List.Item
                        key={n.id}
                        style={{ borderLeft: `4px solid ${meta.color}`, paddingLeft: 12 }}
                        actions={[
                          <Button
                            key="view"
                            type="text"
                            icon={<EyeOutlined />}
                            aria-label="View details"
                          />,
                        ]}
                        onClick={async () => {
                          setActiveNotification(n);
                          setNotificationDrawerOpen(true);
                          if (!n.is_read) {
                            try {
                              await markOneRead.mutateAsync(n.id);
                            } catch {
                              // ignore
                            }
                          }
                        }}
                      >
                        <List.Item.Meta
                          avatar={
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 12,
                                background: 'rgba(0,0,0,0.04)',
                                display: 'grid',
                                placeItems: 'center',
                                color: meta.color,
                              }}
                              aria-hidden
                            >
                              {meta.icon}
                            </div>
                          }
                          title={
                            <Space size={8} wrap>
                              <Text strong>{n.subject}</Text>
                              {!n.is_read ? <Tag color="red">Unread</Tag> : null}
                            </Space>
                          }
                          description={
                            <>
                              <div>{n.body}</div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {timeAgo(n.created_at)}
                              </Text>
                            </>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Empty description="You're all caught up!" />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <ChartCard
            icon={<LineChartOutlined />}
            title="User Growth"
            subtitle="Last 6 months"
            actions={
              <Button size="small" onClick={() => refetch()} aria-label="Refresh dashboard data">
                Refresh
              </Button>
            }
          >
            {userGrowthData.length ? (
              <MiniLineChart
                data={userGrowthData.map((p) => ({ label: p.label, value: p.users }))}
                stroke="#667eea"
              />
            ) : (
              <Empty description="No growth data yet" />
            )}
          </ChartCard>
        </Col>
      </Row>

      <div style={{ height: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCard icon={<PieChartOutlined />} title="Department Distribution" subtitle="Students by department">
            {pieData.length ? (
              <MiniDonutChart
                centerLabel="Students"
                slices={pieData.map((p, idx) => {
                  const palette = ['#667eea', '#764ba2', '#2196f3', '#4caf50', '#ff9800', '#00bcd4', '#f44336'];
                  return { label: p.department, value: p.count, color: palette[idx % palette.length] };
                })}
              />
            ) : (
              <Empty description="No department data yet" />
            )}
          </ChartCard>
        </Col>

        <Col xs={24} lg={12}>
          <ChartCard icon={<BarChartOutlined />} title="Enrollments" subtitle="By department (selected period)">
            {barData.length ? (
              <MiniBarList
                items={barData.map((b) => ({ label: b.department, value: b.count }))}
              />
            ) : (
              <Empty description="No enrollment data yet" />
            )}
          </ChartCard>
        </Col>
      </Row>

      <div style={{ height: 16 }} />
      <Card bodyStyle={{ padding: 16 }}>
        <SectionHeader
          icon={<UserOutlined />}
          title="Recent Registrations"
          subtitle="Latest accounts created in the system"
          extra={
            <Space wrap>
              <Input
                allowClear
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                prefix={<SearchOutlined />}
                placeholder="Search users..."
                style={{ width: 220, maxWidth: '100%' }}
              />
              <Select
                allowClear
                placeholder="Role"
                value={roleFilter}
                onChange={(v) => setRoleFilter(v)}
                style={{ width: 160 }}
                options={[
                  { label: 'Student', value: 'STUDENT' },
                  { label: 'Teacher', value: 'TEACHER' },
                  { label: 'HOD', value: 'HOD' },
                  { label: 'Admin', value: 'ADMIN' },
                ]}
              />
              <Select
                allowClear
                placeholder="Status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                style={{ width: 160 }}
                options={[
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Pending', value: 'PENDING' },
                ]}
              />
              <Button icon={<DownloadOutlined />} onClick={exportRecentUsers}>
                Export CSV
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/dashboard/users/new')}>
                Add User
              </Button>
              <Button type="link" onClick={() => navigate('/dashboard/users')}>
                View all
              </Button>
            </Space>
          }
        />

        <div style={{ marginTop: 14 }}>
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : filteredRecentUsers.length ? (
            <Table
              columns={recentUserColumns}
              dataSource={filteredRecentUsers}
              rowKey="id"
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              onRow={(record) => ({
                onClick: () => {
                  setActiveUser(record);
                  setUserDrawerOpen(true);
                },
              })}
            />
          ) : (
            <Empty description="No new registrations yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </Card>

      <div style={{ height: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card bodyStyle={{ padding: 16 }} style={{ height: '100%' }}>
            <SectionHeader
              icon={<BookOutlined />}
              title="Departments Overview"
              subtitle="Capacity, health, and quick stats"
              extra={
                <Space wrap>
                  <Button icon={<DownloadOutlined />} onClick={exportDepartments}>
                    Export CSV
                  </Button>
                  <Button type="link" onClick={() => navigate('/dashboard/departments')}>
                    View all
                  </Button>
                </Space>
              }
            />

            <div style={{ marginTop: 14 }}>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : filteredDepartments.length ? (
                <Table
                  columns={departmentColumns}
                  dataSource={filteredDepartments}
                  rowKey="id"
                  pagination={{ pageSize: 8, hideOnSinglePage: true }}
                />
              ) : (
                <Empty description="Add your first department to get started" />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card bodyStyle={{ padding: 16 }} style={{ height: '100%' }}>
            <SectionHeader
              icon={<TeamOutlined />}
              title="Activity Feed"
              subtitle="Real-time recent activities"
              extra={
                <Button
                  onClick={() => setActivityVisible((n) => n + 8)}
                  disabled={(data?.activity_feed || []).length <= activityVisible}
                >
                  Load more
                </Button>
              }
            />

            <div style={{ marginTop: 14 }}>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (data?.activity_feed || []).length ? (
                <List
                  dataSource={(data?.activity_feed || []).slice(0, activityVisible)}
                  renderItem={(item) => <ActivityItem item={item} onClick={() => navigate(item.route)} />}
                />
              ) : (
                <Empty description="No recent activity yet" />
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Drawer title="Notification Details" open={notificationDrawerOpen} onClose={() => setNotificationDrawerOpen(false)} width={520}>
        {activeNotification ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text strong style={{ fontSize: 16 }}>{activeNotification.subject}</Text>
              <div style={{ marginTop: 6 }}>
                <Text type="secondary">{activeNotification.body}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary">Received</Text>
              <div style={{ marginTop: 6 }}>
                <Text>{new Date(activeNotification.created_at).toLocaleString()}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary">Metadata</Text>
              <pre style={{ marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid var(--stroke)', background: 'var(--surface-muted)' }}>
                {JSON.stringify(activeNotification.metadata || {}, null, 2)}
              </pre>
            </div>
          </Space>
        ) : null}
      </Drawer>

      <Drawer title="User Details" open={userDrawerOpen} onClose={() => setUserDrawerOpen(false)} width={420}>
        {activeUser ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space size={12}>
              <Avatar style={{ background: brandGradient, fontWeight: 900 }} size={56}>
                {initialsFrom(activeUser.name || activeUser.email)}
              </Avatar>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <Text strong style={{ fontSize: 18 }}>{activeUser.name}</Text>
                <Text type="secondary">{activeUser.email}</Text>
              </div>
            </Space>
            <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/dashboard/users/${activeUser.id}/edit`)}>
              Edit User
            </Button>
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default AdminDashboard;
