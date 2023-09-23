import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'

const app = new Hono()

// make that json pretty!!
app.use('*', prettyJSON())

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

export default app
