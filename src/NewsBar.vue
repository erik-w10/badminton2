<script setup lang="ts">
    import { ref, computed, nextTick } from 'vue'

    const props = defineProps<{
        /** Lines of text that will appear in the news bar or [] to hide the news bar */
        text : string[],
        /** Make lines light up after they are updated (if true) */
        effect : boolean
    }>()

    let allNews : string[] = []
    const oldNews = ref("(oud nieuws)")
    const newNews = ref("(echt nieuws)")
    let newsIndex = 0
    let newsTimer : NodeJS.Timeout | null = null
    let updateEffect = false

    const barIsEnabled = computed<boolean>(() => {
        let enabled = props.text.length > 0
        let changed = (props.text.length != allNews.length) || props.text.some((x, idx) => (x != allNews[idx]) || (updateEffect != props.effect))
        if (changed) {
            stopNews()
            if (enabled) startNews(props.text, props.effect)
        }
        return enabled
    })

    function stopNews() {
        allNews = []
        if (newsTimer !== null) {
            clearInterval(newsTimer)
            newsTimer = null
        }
    }

    function startNews(lines : string[], effectEnable : boolean) {
        allNews = lines
        oldNews.value = ""
        newsIndex = 0
        updateEffect = effectEnable
        if (allNews.length != 0) {
            newsTimer = setInterval(newsUpdate, 10000)
            nextTick(() => newsUpdate())
        }
    }

    function newsUpdate() {
        let nbs = document.getElementById("newsBarShift") as HTMLElement
        oldNews.value = newNews.value
        if (newsIndex >= allNews.length) newsIndex = 0
        newNews.value = allNews[newsIndex++]
        let keyFrames = {
            top: ["0%", "-100%"]
        }
        let options : KeyframeAnimationOptions = {
            duration: 1000,
            iterations: 1,
            easing: "ease-in-out",
            fill:  "forwards",
        }
        let anim = nbs.animate(keyFrames, options)
        if (updateEffect) anim.onfinish = () => {
            let nn = document.getElementById("newNews") as HTMLElement
            let color = "rgb(255,117,37)"
            let keyFrames = [
                {offset: 0.0, color: `red`, textShadow: `2px 2px 2px ${color}, -2px -2px 2px ${color}` },
                {offset: 0.1, color: "unset", textShadow: `2px 2px 2px ${color}, -2px -2px 2px ${color}` },
                {offset: 1, textShadow: `0px 0px 0px ${color}` }
            ]
            let options : KeyframeAnimationOptions = {
                duration: 3000,
                iterations: 1,
                easing: "ease-in-out",
                fill:  "forwards",
            }
            nn.animate(keyFrames, options)
        }
    }
</script>

<template>
    <div id="newsBar" v-if="barIsEnabled">
        <div id="newsBarShift">
            <!-- Some alternatives: star &#9733, badminton &#127992, megaphone &#128226  -->
            <div><div><span class="newsEmoji">&#128226;</span><span>{{ oldNews }}</span></div></div>
            <div><div><span class="newsEmoji">&#128226;</span><span id="newNews">{{ newNews }}</span></div></div>
        </div>
    </div>
</template>

<style>
    #newsBar {
        /* flex child bit: */
        flex: 0 0 3rem;         /* Fixed height, elastic main appliciation section uses the remaining viewport height */
        width: 100vw;

        position: relative;     /* Box reference for embedded 'absolute' positioned child elements */
        overflow: hidden;       /* Clip anything that does not fit */
    }

    #newsBarShift {
        position: absolute;
        top: 0px;
        left: 0px;
        height: 200%;           /* Twice the height of the (clipping) parent div, we can "scroll" by moving this div up */
        width:  100%;
        background-color: rgb(220,220,220);
    }

    #newsBarShift > div {
        height: 50%;            /* There are two of these divs (old news and new news) */
        width: 100%;
        display: flex;              /* Now to center text in this box */
        flex-direction: column;
        justify-content: center;    /* Center content on main axis (note that grow must be 0 or there will be no space to divide up) */
        overflow: hidden;
    }

    #newsBarShift > div > div {
        width: 200vw;
        font-size: x-large;
        overflow: hidden;
        padding-left: 1em;
    }

    #newsBarShift > div > div span {
        display: inline;
    }
    span.newsEmoji {
        padding-right: 0.7em;
    }
</style>
