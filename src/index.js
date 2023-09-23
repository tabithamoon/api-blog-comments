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
    // generate a unique identifier for this request
    const requestIP = c.req.header('CF-Connecting-Ip')
    const newKey = await crypto.randomUUID()

    const data = {
        source: requestIP,
        status: "created"
    }

    await c.env.KEYS.put(newKey, JSON.stringify(data), {expirationTtl: 90})

    return c.json({
        key: newKey,
        ttl: 90
    })
})

app.post('/new/:pageId', async (c) => {
    const requestIP = c.req.header('CF-Connecting-Ip')
    const pageId = c.req.param('pageId')
    let req = {}

    // Try to parse body as JSON, catch error if it fails and return bad request
    try {
        // Make sure we're getting a json here
        if (c.req.header('Content-Type') !== "application/json")
            throw new Error()
        
        req = await c.req.json()
    }
    catch {
        c.header('Content-Type', 'text/plain')
        return c.text('Bad Request', 400)
    }
    
    // check if requester has a valid key
    const key = await c.env.KEYS.get(req.key)

    //TODO: this is unfinished!! get rid of this console long when it isn't!!
    console.log(key)

    c.header('Content-Type', 'text/plain')
    return c.text('OK', 200) //TODO: Stub
})

export default app
