import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'

const app = new Hono()

// make that json pretty!!
app.use('*', prettyJSON())

app.get('/', (c) => {
    return c.body("Hello! Use the /get endpoint to query comments. The other routes are reserved for the frontend.")
})

// get all comments for a specific page.
app.get('/get/:pageId', async (c) => {
    // get the page ID from the request path
    const pageId = c.req.param('pageId')
    
    // call me a db admin with my amazingly complex queries
    const comments = await c.env.DB.prepare(
        `SELECT
            Author,
            Body,
            Timestamp
        FROM
            Comments
        WHERE
            PageId = ?`
    ).bind(pageId).all()

    return c.json(comments.results)
})

app.get('/key', async (c) => {
    // get request's IP address
    const requestIP = c.req.header('CF-Connecting-Ip')

    // check if address already commented recently
    const addr = await c.env.ADDRESSES.get(requestIP)

    // boot them out if that is the case. don't spam!
    if(addr !== null)
        return c.text('Too many requests', 429)

    // if they ain't spamming, generate a fresh key for our fine user
    const newKey = await crypto.randomUUID()

    // assemble our object
    const data = {
        source: requestIP,
        status: "created"
    }

    // store it in KV
    await c.env.KEYS.put(newKey, JSON.stringify(data), {expirationTtl: 90})

    // return it to the frontend
    return c.text(newKey, 200)
})

app.post('/new/:pageId', async (c) => {
    // store IP address and requested page
    const requestIP = c.req.header('CF-Connecting-Ip')
    const pageId = c.req.param('pageId')

    // our request object we're about to fill with parsed data
    let req = {}

    // try to parse body as JSON
    // catch error if it fails and return a bad request code
    try {
        if (c.req.header('Content-Type') !== "application/json")
            throw new Error()
        
        req = await c.req.json()
    }
    catch {
        return c.text('Bad Request', 400)
    }
    
    // get key and IP address info
    const key = JSON.parse(await c.env.KEYS.get(req.key))
    const addr = await c.env.ADDRESSES.get(requestIP)

    // boot them out if they don't have a nice and fresh key
    if(key === null)
        return c.text('Unauthorized', 401)

    // boot them out if their address doesn't match the key's origin
    if(key.source !== requestIP)
        return c.text('Unauthorized', 401)

    // boot them out if they're trying to spam. naughty!
    if(addr !== null)
        return c.text('Too many requests', 429)

    // check if the requested page exists
    const pagecheck = await c.env.DB.prepare(
        `SELECT
            PageId
        FROM
            Pages
        WHERE
            PageId = ?`
    ).bind(pageId).all()

    if(pagecheck.results.length <= 0)
        return c.text('Bad request', 400)

    // generate an unique comment ID
    const newKey = await crypto.randomUUID()

    // save that comment!! yay
    const result = await c.env.DB.prepare(
        `INSERT INTO Comments
        (PageId, CommentId, Author, Body, Timestamp)
        VALUES (?1, '${newKey}', ?2, ?3, '${new Date().toISOString()}')
        `
    ).bind(
        pageId,
        req.author,
        req.body
    ).run()

    if (result.success) {
        // store requester's address for 5 minutes, for basic spam prevention
        await c.env.ADDRESSES.put(requestIP, 'posted', {expirationTtl: 300})
        return c.text('OK', 200)
    }
    else {
        // something went wrong 3:
        // log it so i can figure out what i messed up
        console.log(result)
        return c.text('Internal server error', 500)
    }
})

export default app
