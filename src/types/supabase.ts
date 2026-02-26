export interface Profile {
  id: string
  user_id: string
  username: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface File {
  id: string
  name: string
  bucket: string
  path: string
  created_at: string
  updated_at: string
}
