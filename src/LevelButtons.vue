<script setup lang="ts">
    import { onMounted, ref } from 'vue'

    const props = defineProps<{
        level : number
    }>()
    const emits = defineEmits<{'set': [newLevel : number]}>()

    const level = ref<number>(1);
    const allLevels = ref<number[]>([1,2,3,4,5]);
    const levelButtons = ref<HTMLButtonElement[]|null>(null);

    onMounted(() => {
        let v = props.level
        level.value = (!Number.isInteger(v) || v < 1 || v > 5) ? 1 : v;
        if (levelButtons.value === null) return;
        let b = levelButtons.value[v-1];
        b.focus();
    });

    function checkDigit(e : KeyboardEvent) : boolean
    {
        let newLevel = 0;
        if ((levelButtons.value !== null) && (e.key.length == 1)) {
            switch(e.key[0]) {
                case '1': newLevel = 1; break;
                case '2': newLevel = 2; break;
                case '3': newLevel = 3; break;
                case '4': newLevel = 4; break;
                case '5': newLevel = 5; break;
            }
            if (newLevel) {
                level.value = newLevel;
                levelButtons.value[newLevel-1].focus();
            }
        }
        return newLevel != 0;
    }
</script>

<template>
    <div @keyup="checkDigit($event) && $emit('set', level)">
        <button 
            ref="levelButtons"
            @click="level = lvl; $emit('set', lvl)"
            class="levelButton button"
            :class="{'is-info' : (lvl == level), 'is-outlined' : (lvl != level)}"
            v-for="lvl in allLevels"
        >
            {{ lvl }}
        </button>
    </div>
</template>


<style>
    .levelButton:nth-of-type(1n+1) {
        margin-left: 1em;
    }
</style>
