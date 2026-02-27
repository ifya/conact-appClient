import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { clsx } from 'clsx';
import { UserContextMenu } from './UserContextMenu';
import { useFriendsStore } from '../store/friends';

interface Member {
  userId: string;
  user: {
    id: string;
    matrixUserId?: string;
    displayName: string;
    avatarUrl?: string;
    status: string;
  };
  role?: {
    id: string;
    name: string;
    color?: string;
  };
  state: string;
}

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  member: Member | null;
}

interface MemberListProps {
  guildId: string;
}

export function MemberList({ guildId }: MemberListProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    member: null,
  });

  const { fetchFriends, fetchRequests } = useFriendsStore();

  // Fetch friends data on mount
  useEffect(() => {
    fetchFriends();
    fetchRequests();
  }, [fetchFriends, fetchRequests]);

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', guildId],
    queryFn: () => api.getMembers(guildId),
  });

  const handleContextMenu = (e: React.MouseEvent, member: Member) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      member,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, member: null });
  };

  if (isLoading) {
    return (
      <div className="w-60 bg-background-secondary p-4">
        <div className="text-text-muted">Loading members...</div>
      </div>
    );
  }

  // Group members by role
  const membersByRole = ((members || []) as Member[]).reduce<Record<string, Member[]>>(
    (acc, member) => {
      const roleName = member.role?.name || 'Online';
      if (!acc[roleName]) {
        acc[roleName] = [];
      }
      acc[roleName].push(member);
      return acc;
    },
    {}
  );

  // Sort roles by name, but keep "Admin" and other special roles at top
  const sortedRoles = Object.keys(membersByRole).sort((a, b) => {
    if (a === 'Admin') return -1;
    if (b === 'Admin') return 1;
    if (a === '@everyone') return 1;
    if (b === '@everyone') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="w-60 flex-shrink-0 overflow-y-auto bg-background-secondary p-2 scrollbar-thin">
      {sortedRoles.map((roleName) => (
        <div key={roleName} className="mb-4">
          <h3 className="mb-1 px-2 text-xs font-semibold uppercase text-text-muted">
            {roleName} — {membersByRole[roleName].length}
          </h3>
          <div className="space-y-0.5">
            {membersByRole[roleName].map((member) => (
              <button
                key={member.userId}
                className="sidebar-item w-full"
                onContextMenu={(e) => handleContextMenu(e, member)}
              >
                <div className="relative">
                  <div className="avatar h-8 w-8 text-sm">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt=""
                        className="h-full w-full rounded-full"
                      />
                    ) : (
                      member.user.displayName?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div
                    className={clsx(
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background-secondary',
                      member.user.status === 'active'
                        ? 'bg-status-online'
                        : 'bg-status-offline'
                    )}
                  />
                </div>
                <span
                  className="truncate text-sm"
                  style={{ color: member.role?.color }}
                >
                  {member.user.displayName}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {(!members || members.length === 0) && (
        <div className="p-4 text-center text-sm text-text-muted">
          No members found
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.isOpen && contextMenu.member && (
        <UserContextMenu
          userId={contextMenu.member.user.id}
          displayName={contextMenu.member.user.displayName}
          matrixUserId={contextMenu.member.user.matrixUserId}
          position={contextMenu.position}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
