export const getUserId = (): string => {
  let userId = localStorage.getItem('ilka_user_id')
  if (!userId) {
    userId = `user-${crypto.randomUUID()}`
    localStorage.setItem('ilka_user_id', userId)
    console.log('Generated new user ID:', userId)
  }
  return userId
}
