import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare,
  Send,
  MoreHorizontal,
  Edit2,
  Trash2,
  Reply,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, formatRelative } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Comment, CommentEntityType, Profile } from '@/types'

interface CommentsProps {
  entityType: CommentEntityType
  entityId: string
  className?: string
}

export function Comments({ entityType, entityId, className }: CommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  // Fetch comments
  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:author_id (id, full_name, avatar_url, role)
        `)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data as (Comment & { author: Profile })[]
    },
  })

  // Fetch team members for @mentions
  const { data: teamMembers } = useQuery({
    queryKey: ['profiles-for-mentions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .eq('is_active', true)
        .order('full_name')
      
      if (error) throw error
      return data as Profile[]
    },
  })

  // Filter members for mention dropdown
  const filteredMembers = teamMembers?.filter(m =>
    m.full_name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5) || []

  // Add comment mutation
  const addMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      // Extract mentions from content
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      const mentions: string[] = []
      let match
      while ((match = mentionRegex.exec(content)) !== null) {
        mentions.push(match[2]) // User ID
      }

      const { data, error } = await supabase
        .from('comments')
        .insert({
          content,
          author_id: user?.id,
          entity_type: entityType,
          entity_id: entityId,
          parent_id: parentId || null,
          mentions,
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] })
      setNewComment('')
      setReplyContent('')
      setReplyingTo(null)
    },
  })

  // Update comment mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from('comments')
        .update({ content, is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] })
      setEditingId(null)
      setEditContent('')
    },
  })

  // Delete comment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] })
    },
  })

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${entityType}:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `entity_type=eq.${entityType}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [entityType, entityId, queryClient])

  // Handle input change with @mention detection
  const handleInputChange = (value: string, isReply = false) => {
    const setter = isReply ? setReplyContent : setNewComment
    setter(value)
    
    // Check if we're typing a mention
    const cursorPos = inputRef.current?.selectionStart || 0
    setCursorPosition(cursorPos)
    
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      // Check if there's no space after @ (still typing mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes(']')) {
        setMentionQuery(textAfterAt)
        setShowMentions(true)
        return
      }
    }
    setShowMentions(false)
  }

  // Insert mention
  const insertMention = (member: Profile, isReply = false) => {
    const currentValue = isReply ? replyContent : newComment
    const setter = isReply ? setReplyContent : setNewComment
    
    const textBeforeCursor = currentValue.slice(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    const textAfterCursor = currentValue.slice(cursorPosition)
    
    const mentionText = `@[${member.full_name}](${member.id}) `
    const newValue = currentValue.slice(0, lastAtIndex) + mentionText + textAfterCursor
    setter(newValue)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  // Render comment content with mentions highlighted
  const renderContent = (content: string) => {
    // Replace @[Name](id) with styled mention
    const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g)
    
    return parts.map((part, i) => {
      const mentionMatch = part.match(/@\[([^\]]+)\]\(([^)]+)\)/)
      if (mentionMatch) {
        return (
          <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
            @{mentionMatch[1]}
          </span>
        )
      }
      return part
    })
  }

  // Group comments into parents and replies
  const parentComments = comments?.filter(c => !c.parent_id) || []
  const repliesByParent = comments?.reduce((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = []
      acc[c.parent_id].push(c)
    }
    return acc
  }, {} as Record<string, typeof comments>) || {}

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Comments ({comments?.length || 0})</h3>
      </div>

      {/* Comment List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading comments...</div>
        ) : parentComments.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          parentComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={repliesByParent[comment.id]}
              currentUserId={user?.id}
              isEditing={editingId === comment.id}
              editContent={editContent}
              replyingTo={replyingTo}
              replyContent={replyContent}
              onEdit={(id, content) => {
                setEditingId(id)
                setEditContent(content)
              }}
              onCancelEdit={() => {
                setEditingId(null)
                setEditContent('')
              }}
              onSaveEdit={(id) => updateMutation.mutate({ id, content: editContent })}
              onEditContentChange={setEditContent}
              onDelete={(id) => deleteMutation.mutate(id)}
              onReply={(id) => {
                setReplyingTo(replyingTo === id ? null : id)
                setReplyContent('')
              }}
              onReplyContentChange={(val) => handleInputChange(val, true)}
              onSubmitReply={(parentId) => addMutation.mutate({ content: replyContent, parentId })}
              renderContent={renderContent}
              isSubmitting={addMutation.isPending || updateMutation.isPending}
              showMentions={showMentions && replyingTo === comment.id}
              filteredMembers={filteredMembers}
              onInsertMention={(m) => insertMention(m, true)}
              inputRef={inputRef}
            />
          ))
        )}
      </div>

      {/* New Comment Form */}
      <div className="relative">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{getInitials(user?.full_name || '')}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Write a comment... Use @ to mention someone"
              className="w-full min-h-[80px] px-3 py-2 border rounded-lg bg-background text-sm resize-none"
              disabled={addMutation.isPending}
            />
            {showMentions && !replyingTo && filteredMembers.length > 0 && (
              <MentionDropdown members={filteredMembers} onSelect={(m) => insertMention(m)} />
            )}
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                onClick={() => addMutation.mutate({ content: newComment })}
                disabled={!newComment.trim() || addMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Post Comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mention dropdown component
function MentionDropdown({ 
  members, 
  onSelect 
}: { 
  members: Profile[]
  onSelect: (member: Profile) => void 
}) {
  return (
    <div className="absolute z-10 mt-1 w-64 bg-background border rounded-lg shadow-lg max-h-48 overflow-auto">
      {members.map((member) => (
        <button
          key={member.id}
          onClick={() => onSelect(member)}
          className="w-full flex items-center gap-2 p-2 hover:bg-muted transition-colors text-left"
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={member.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{getInitials(member.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{member.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{member.role.replace('_', ' ')}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// Single comment item component
interface CommentItemProps {
  comment: Comment & { author: Profile }
  replies?: (Comment & { author: Profile })[]
  currentUserId?: string
  isEditing: boolean
  editContent: string
  replyingTo: string | null
  replyContent: string
  onEdit: (id: string, content: string) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onEditContentChange: (content: string) => void
  onDelete: (id: string) => void
  onReply: (id: string) => void
  onReplyContentChange: (content: string) => void
  onSubmitReply: (parentId: string) => void
  renderContent: (content: string) => React.ReactNode
  isSubmitting: boolean
  showMentions: boolean
  filteredMembers: Profile[]
  onInsertMention: (member: Profile) => void
  inputRef: React.RefObject<HTMLTextAreaElement>
}

function CommentItem({
  comment,
  replies,
  currentUserId,
  isEditing,
  editContent,
  replyingTo,
  replyContent,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  onDelete,
  onReply,
  onReplyContentChange,
  onSubmitReply,
  renderContent,
  isSubmitting,
  showMentions,
  filteredMembers,
  onInsertMention,
  inputRef,
}: CommentItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const isOwner = currentUserId === comment.author_id

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{getInitials(comment.author?.full_name || '')}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{comment.author?.full_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelative(comment.created_at)}
            </span>
            {comment.is_edited && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>
          
          {isEditing ? (
            <div className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => onEditContentChange(e.target.value)}
                className="w-full min-h-[60px] px-3 py-2 border rounded-lg bg-background text-sm resize-none"
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => onSaveEdit(comment.id)} disabled={isSubmitting}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-1">{renderContent(comment.content)}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => onReply(comment.id)}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
            
            {isOwner && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {showMenu && (
                  <div className="absolute left-0 top-6 bg-background border rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        onEdit(comment.id, comment.content)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        onDelete(comment.id)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-destructive w-full"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="ml-11 relative">
          <textarea
            ref={inputRef}
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder="Write a reply..."
            className="w-full min-h-[60px] px-3 py-2 border rounded-lg bg-background text-sm resize-none"
          />
          {showMentions && filteredMembers.length > 0 && (
            <MentionDropdown members={filteredMembers} onSelect={onInsertMention} />
          )}
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => onSubmitReply(comment.id)}
              disabled={!replyContent.trim() || isSubmitting}
            >
              Reply
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReply(comment.id)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Replies */}
      {replies && replies.length > 0 && (
        <div className="ml-11 space-y-3 border-l-2 border-muted pl-4">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <Avatar className="h-6 w-6">
                <AvatarImage src={reply.author?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{getInitials(reply.author?.full_name || '')}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{reply.author?.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(reply.created_at)}
                  </span>
                </div>
                <p className="text-sm mt-1">{renderContent(reply.content)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
