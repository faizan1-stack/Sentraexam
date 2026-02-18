import { Result, Button } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface ComingSoonPageProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  extra?: ReactNode;
}

const ComingSoonPage = ({
  title,
  description,
  actionLabel,
  actionTo,
  extra,
}: ComingSoonPageProps) => {
  const navigate = useNavigate();

  const action =
    extra ??
    (actionLabel && actionTo ? (
      <Button type="primary" onClick={() => navigate(actionTo)}>
        {actionLabel}
      </Button>
    ) : null);

  return (
    <Result
      status="info"
      title={title}
      subTitle={description ?? 'This section is coming soon.'}
      extra={action}
    />
  );
};

export default ComingSoonPage;
