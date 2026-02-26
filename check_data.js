
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read supabase config from the project
const supabaseJsPath = path.join(__dirname, 'js', 'supabase.js');
const content = fs.readFileSync(supabaseJsPath, 'utf8');

const urlMatch = content.match(/const SUPABASE_URL = '([^']+)';/);
const keyMatch = content.match(/const SUPABASE_ANON_KEY = '([^']+)';/);

if (!urlMatch || !keyMatch) {
    console.error('Could not find Supabase config');
    process.exit(1);
}

const supabaseUrl = urlMatch[1];
const supabaseAnonKey = keyMatch[1];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    console.log('--- Checking Supabase Data for 2026-02-26 ---');

    const today = '2026-02-26';

    const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('date', today);

    if (taskError) {
        console.error('Task Error:', taskError);
    } else {
        console.log(`Found ${tasks.length} tasks for ${today}:`);
        tasks.forEach(t => {
            console.log(` - ID: ${t.id}, User: ${t.userid || t.userId}, Text: ${t.text}, Date: ${t.date}`);
        });
    }

    const { data: comments, error: commentError } = await supabase
        .from('task_comments')
        .select('*')
        .eq('date', today);

    if (commentError) {
        console.error('Comment Error:', commentError);
    } else {
        console.log(`Found ${comments.length} comments for ${today}:`);
        comments.forEach(c => {
            console.log(` - ID: ${c.id}, User: ${c.userid || c.userId}, Content: ${c.content}, Date: ${c.date}`);
        });
    }

    // Check all tasks to see if they exist for other dates
    const { data: allTasks } = await supabase.from('tasks').select('date').limit(10);
    console.log('Sample dates from tasks table:', allTasks.map(t => t.date));
}

checkData();
