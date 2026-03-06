$headers = @{ "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZmZvem5mamRsdGlxeHdoaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg3NjEsImV4cCI6MjA4NzQ4NDc2MX0.aBthoW9n9YiC0zYKgSMBToJkDu2uLb9BPPVb2RNHB0Y" }
$url = "https://uiffoznfjdltiqxwhiwi.supabase.co/rest/v1/task_comments?select=*&limit=1"
$resp = Invoke-WebRequest -Uri $url -Headers $headers -Method Get
$json = $resp.Content | ConvertFrom-Json
$json | Get-Member -MemberType NoteProperty | ForEach-Object { $_.Name }
