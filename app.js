const express = require('express');
const port = 3000;
const jwt = require("jsonwebtoken");
const { Op, Sequelize } = require("sequelize");
const { User, Post, Comment, Like } = require('./models')
const Joi = require('joi');
const SECRET_KEY = "VOYAGE"
const loginCheck = require('./middlewares/login-check')

const app = express();
app.use(express.json())
const router = express.Router();
app.use("/api", express.urlencoded({ extended: false }), router);
app.use(express.static("assets"));

const sequelize = new Sequelize('voyage_blog_development', 'root', '', {
    host: 'localhost',
    dialect: 'mysql'
});

const createUserObject = Joi.object({
    nickname: Joi.string().required(),
    password: Joi.string().required(),
    confirmPassword: Joi.string().required(),
})

// Auth
router.post("/signup", async (req, res) => {
    try {
        const {
            nickname,
            password,
            confirmPassword,
        } = await createUserObject.validateAsync(req.body);

        if (password !== confirmPassword) {
            res.status(400).send({
                errorMessage: "Password is not the same as password checkbox",
            });
            return;
        }

        const existUsers = await User.findAll({
            where: {
                [Op.or]: [{ nickname }],
            }
        });
        if (existUsers.length) {
            res.status(400).send({
                errorMessage: "This is a duplicate nickname.",
            });
            return;
        }

        await User.create({ nickname, password });
        res.status(201).send({});
    } catch (err) {
        console.log(err);
        res.status(400).send({
            errorMessage: "Something error with sign up",
        });
    }
});

const requestSignIn = Joi.object({
    nickname: Joi.string().required(),
    password: Joi.string().required(),
})

router.post('/login', async (req, res) => {
    try {
        const { nickname, password } = await requestSignIn.validateAsync(req.body)

        const user = await User.findOne({
            where: {
                nickname
            },
        })

        if (!user || password !== user.password) {
            res.status(400).send({
                errorMessage: "Please check your nickname or password",
            });
            return;
        }

        const token = jwt.sign({ userId: user.userId }, SECRET_KEY);
        res.send({
            token,
        });

    } catch (error) {
        res.status(400).send({
            errorMessage: "Something error with sign in",
        });
    }
})

const requestPost = Joi.object({
    title: Joi.string().required(),
    content: Joi.string().required(),
})

// Post
router.post('/posts', loginCheck, async (req, res) => {
    try {
        const { title, content } = await requestPost.validateAsync(req.body)
        const { user } = res.locals;
        await Post.create({ userId: user.userId, title, content, likes:0 })
        res.status(201).send({});

    } catch (error) {
        res.status(400).send({
            errorMessage: "Something error with create posts",
        });
    }
})

router.get('/posts', async (req, res) => {
    try {
        // const posts = await Post.findAll({})
        // const postIds = posts.map((item) => item.postId )    
        // const posts = await Post.findAll({ include: User });
        const posts = await sequelize.query('select posts.postId, posts.userId, nickname, title, content, posts.createdAt, posts.updatedAt, likes  from posts join users on users.userId = posts.userId', {
            type: sequelize.QueryTypes.SELECT
        });
        const postIds = posts.map((item) => item.postId)
        // const likes = await Like.count({
        //     where: {
        //         postId: 1
        //     }
        // })
        const likes = await sequelize.query('select postId ,count(postId) as likes from likes  where status = true group by postId' , {
            type: sequelize.QueryTypes.SELECT
        })


        
        // const likes = await Like.findAll({
        //     attributes: [
        //       'postId',
        //       [sequelize.fn('COUNT', sequelize.col('postId')), 'likes'],
        //     ],
        //     where: {
        //         postId: 1
        //     }
        //   });
        let result = []
        posts.map((post) => {
            likes.map((like)=> {
                if(post.postId === like.postId){
                    // console.log(post.postId)
                    // console.log(like.postId)
                    result['data'] = post
                    result['likes'] = like.likes
                    console.log(result)
                }
            })
        })
        
        res.status(200).send({
            data: posts,
            likes,
            // postIds,
            // result
        })
    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with get posts",
        });
    }
})
router.get('/posts/:postId', async (req, res) => {
    try {
        const { postId } = req.params
        const posts = await sequelize.query(`select postId, posts.userId, nickname, title, content, posts.createdAt, posts.updatedAt  from posts join users on users.userId = posts.userId where postId = ${postId}`, {
            type: sequelize.QueryTypes.SELECT
        });
        res.status(200).send({
            data: posts
        })
    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with get posts",
        });
    }
})

router.put('/posts/:postId', loginCheck, async (req, res) => {
    try {
        const { userId } = res.locals.user
        const { postId } = req.params
        const { title, content } = req.body

        const post = await Post.findOne({
            where: {
                userId,
                postId
            }
        })

        if (post && title && content) {
            post.title = title
            post.content = content
            await post.save()
            res.send({})
        } else {
            res.status(400).send({
                errorMessage: "Data not found"
            })

        }

    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with update posts",
        });
    }


})

router.delete('/posts/:postId', loginCheck, async (req, res) => {
    try {
        const { userId } = res.locals.user
        const { postId } = req.params

        const post = await Post.findOne({
            where: {
                userId,
                postId
            }
        })

        if (post) {
            await post.destroy()
            res.send({})
        }
    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with delete posts",
        });
    }
})

// Comment 
router.post('/comments/:postId', loginCheck, async (req, res) => {
    try {
        const { postId } = req.params
        const { userId } = res.locals.user
        const { comment } = req.body

        await Comment.create({
            userId,
            postId,
            comment
        })

        res.status(201).send({});
    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with create comment",
        });
    }
})

router.get('/comments/:postId', async (req, res) => {
    try {
        const { postId } = req.params
        const data = await sequelize.query(`select commentId, comments.userId, nickname, comment, comments.createdAt, comments.updatedAt  from comments join users on users.userId = comments.userId where comments.postId = ${postId} order by createdAt desc`, {
            type: sequelize.QueryTypes.SELECT
        });
        res.status(200).send({
            data
        });
    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with get comment",
        });
    }
})

router.put('/comments/:commentId', loginCheck, async (req, res) => {
    try {
        const { commentId } = req.params
        const { comment } = req.body
        const { userId } = res.locals.user

        const data = await Comment.findOne({
            where: {
                commentId,
                userId
            }
        })

        if (data) {
            if (!comment) {
                return res.status(400).send({
                    errorMessage: "Please enter the comment content"
                })
            }
            data.comment = comment
            await data.save()
            res.send({})
        }
    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with update comment",
        });
    }
})

router.delete('/comments/:commentId', loginCheck, async (req, res) => {
    try {
        const { commentId } = req.params
        const { userId } = res.locals.user
        const comment = await Comment.findOne({
            where: {
                commentId,
                userId
            }
        })
        if (comment) {
            await comment.destroy()
            res.send({})
        }
        res.status(400).send({
            errorMessage: "Not found"
        })
    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with delete comment",
        });
    }
})

// Like
router.post('/posts/:postId/like', loginCheck, async (req, res) => {
    try {
        const { postId } = req.params
        const { userId } = res.locals.user

        const like = await Like.findOne({
            where: {
                postId,
                userId
            }
        })
        let checkStatus
        if (!like) {
            await Like.create({
                postId,
                userId,
                status: true
            })
            res.send({})
        }else {
            like.status = !like.status
            await like.save()
            checkStatus = like.status
            const posts = await Post.findOne({
                where: {
                    postId
                }
            })
            if(checkStatus){
                posts.likes = posts.likes - 1
                await posts.save()
            }else {
                posts.likes = posts.likes + 1
                await posts.save()
            }
            res.send({})
        }

    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with like post",
        });
    }
})

router.get('/posts/user/like', loginCheck, async (req, res) => {
    try {
        const { userId } = res.locals.user

        const likes = await Like.findAll({
            where: {
                userId,
                status: true
            }
        })
        const postIds = likes.map((item) => item.postId)
        if (postIds) {
            const posts = await Post.findAll({
                where: {
                    postId: postIds
                }
            })
            res.send({
                data: posts
            })
        } else {
            res.status(400).send({
                errorMessage: "Not found",
            });
        }

    } catch (error) {
        console.log(error)
        res.status(400).send({
            errorMessage: "Something error with get liked post",
        });
    }
})


app.listen(port, () => {
    console.log(port, 'Server is open with port!');
});