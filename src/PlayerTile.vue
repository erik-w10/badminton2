<script setup lang="ts">
    import { computed } from 'vue';
    import { default as adm, Player, tagForLink } from './player_admin';

    const props = defineProps<{
        player : Player,
        separator : boolean,
        showLevel : boolean,
    }>();
    const emits = defineEmits<{'clicked': []}>();

    const pClass = computed(() => ({
        'list-item'     : true,
        "separator"     : props.separator,
        'male'          : (props.player.gender == 'm'),
        'female'        : (props.player.gender == 'v'),
        'nomail'        : (props.player.gender == 'g'),
        'plr-gone'      : !props.player.participating,
        'plr-paused'    :  props.player.participating && props.player.paused
    }));
    const mClass = computed(() => ({
        'levelOk'      : adm.levelCanPlay[adm.currentLevel(props.player)-1],
        'levelBad'     : !adm.levelCanPlay[adm.currentLevel(props.player)-1]

    }));

    // Get the link tag (or emtpy). Note that this function is accesible from Vue elements (tagForLink is not)
    function playerTag(player : Player) {
        return tagForLink(player.link);
    }
</script>

<template>
    <div class="dragClick" :class="pClass">
        <div class="labelParts" :class="{ makeRoom : props.showLevel }">
            <div class="playerName">{{props.player.name}}</div>
            <div class="playerTag">{{playerTag(props.player)}}</div>
        </div>
        <div class="levelParts" v-if="props.showLevel">
            <div class="levelMask" :class="mClass">{{adm.currentLevel(props.player)}}</div>
        </div>
        <div class=clickParts>
            <div class="dragHdl"></div>
            <div class="clickBtn" @click="$emit('clicked')"></div>
            <div class="dragHdl"></div>
        </div>
    </div>
</template>

<style>
    .male {
        background: #80cee1;
    }

    .female {
        background: #fbccd1;
    }

    .nomail {
        background: #B0C0B0;
    }

    div.plr-gone > div.labelParts div.playerName {
        text-decoration: line-through;
    }

    div.plr-paused > div.labelParts div.playerName{
        font-style: italic;
        color: gray;
    }

    .separator:nth-child(4n) {
        margin-bottom: 12px !important;
    }

    .dragClick {
        position: relative; /* Use as reference for absolute positioning*/
    }

    .labelParts.makeRoom > div {
        margin-left: 0.75em;
    }

    .labelParts {
        padding: 0px;
        display: flex;
        justify-content: space-between;
    }

    .labelParts .playerTag {
        font-weight: normal;
    }

    .levelParts {
        position: absolute; /* Overlap with the entire parent div*/
        top: 0px;
        left: 0px;
        height: 100%;
        width: 100%;
        padding: 0px;
        display: flex;          /* Make child div centered*/
        flex-direction: column;
        justify-content: center;
    }

    .levelParts div.levelMask{
        border-radius: 0 50% 50% 0;
        height: 60%;
        width: 1.25em;
        color: #F0F0F0;
        text-align: center;
        padding-right: 0.25em;
        font-weight: 900;
        color: #A0A0A0;
    }

    .levelParts div.levelMask{
        background: black;
        opacity: 7%;
    }

    .waiting-section .levelParts div.levelMask.levelBad{
        background: red;
        opacity: 100%;
    }

    .clickParts {
        position: absolute; /* Overlap with the entire parent div*/
        top: 0px;
        left: 0px;
        height: 100%;
        width: 100%;
        padding: 0px;
        display: flex;          /* Make child div centered*/
    }

    .clickBtn {
        flex: 3;
    }

    .clickBtn:hover {
        border: 6px solid rgba(255,255,255,.25);
        border-radius: 6px;
    }

</style>
