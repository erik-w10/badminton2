<script setup lang="ts">
    import { computed } from 'vue';
    import { Player, tagForLink } from './player_admin';

    const props = defineProps<{
        player : Player,
        separator : boolean,
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

    // Get the link tag (or emtpy). Note that this function is accesible from Vue elements (tagForLink is not)
    function playerTag(player : Player) {
        return tagForLink(player.link);
    }
</script>

<template>
    <div class="dragClick" :class="pClass">
        <div class="labelParts">
            <div>{{props.player.name}}</div>
            <div class="player-tag">{{playerTag(props.player)}}</div>
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

    div.plr-gone > div.labelParts {
        text-decoration: line-through;
    }

    div.plr-paused > div.labelParts {
        font-style: italic;
        color: gray;
    }

    .separator:nth-child(4n) {
        margin-bottom: 12px !important;
    }

    .labelParts {
        padding: 0px;
        display: flex;
        justify-content: space-between;
    }

    .labelParts .player-tag {
        font-weight: normal;
    }

    .dragClick {
        position: relative; /* Use as reference for absolute positioning*/
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